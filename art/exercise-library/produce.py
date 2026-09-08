"""Blender 批量制作入口；关键帧预览与完整动画明确分开。"""
import argparse, json, math, sys, time
from pathlib import Path
import bpy
from mathutils import Vector as V
ROOT=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT))
from specs import SPECS
import anatomy
from motion import Motion
from equipment import Equipment

def serial(value):
    if isinstance(value,V): return list(value)
    if isinstance(value,dict): return {k:serial(v) for k,v in value.items() if k!='transforms'}
    if isinstance(value,(tuple,list)): return [serial(x) for x in value]
    return value

def base(rebuild=False):
    cache=ROOT/f'cache/anatomy-base-v{anatomy.STYLE_REVISION}.blend'
    if not cache.exists() or rebuild:
        rig,body,pants=anatomy.load_base()
        cache.parent.mkdir(exist_ok=True)
        bpy.ops.wm.save_as_mainfile(filepath=str(cache),compress=True)
    else: bpy.ops.wm.open_mainfile(filepath=str(cache))
    return bpy.data.objects['Exercise rig'],bpy.data.objects['Athletic male / continuous skinned surface'],bpy.data.objects['Graphite compression shorts']

def camera(spec,poses):
    scene=bpy.context.scene; cam=scene.camera
    f,v=spec['family'],spec['variant']
    # 仰卧和地面动作使用较高侧视镜头；背部动作使用后侧镜头。
    ground=f in ['pushup','bridge','leg_press'] or (f=='core' and v not in ['hanging-raise','cable-crunch']) or (f=='press' and v!='seated') or (f=='fly' and v=='supine') or (f=='triceps' and v=='skull') or (f=='leg_curl' and v=='lying')
    points=[]
    for p in poses:
        for joints in p['joints'].values(): points.extend(joints.values())
        points.append(p['transforms']['head']@V((0,.16,0)))
    low=V(tuple(min(p[i] for p in points) for i in range(3))); high=V(tuple(max(p[i] for p in points) for i in range(3)))
    target=(low+high)/2; target.z+=.04
    direction=V((3.4,4.8 if spec['view']=='back' else -5.8,2.3))
    if ground: direction=V((4.8,-3.6 if spec['view']=='front' else 2.8,3.6)); target.z=max(.4,target.z)
    if f=='pushup' or (f=='core' and v=='plank'): direction=V((4.8,-2.5,.17-target.z))
    if f=='bridge': direction=V((3.9,-4.8,.19-target.z))
    if f=='leg_curl' and v=='seated': direction=V((5.5,-2,.27-target.z))
    if f=='hip_machine' and v=='abduction': direction=V((5.8,1.4,1.5))
    if f=='core' and v=='side-plank': direction=V((4.8,-3.0,2.8))
    if spec['apparatus']=='dual-cable': direction=V((1.6,-6.0,2.2))
    cam.location=target+direction
    cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
    cam.data.type='ORTHO'
    rot=cam.rotation_euler.to_matrix().inverted()
    plane=[rot@(point-target) for point in points]
    width=max(p.x for p in plane)-min(p.x for p in plane)
    height=max(p.y for p in plane)-min(p.y for p in plane)
    cam.data.ortho_scale=max(height+.46,(width+.50)*896/768,2.08 if not ground else 1.8)
    # 杠铃外侧片和器械框架也留边，不把人物为迁就整个背景机架压得过小。
    if spec['apparatus'] in ['barbell','smith','hip-barbell','hip-smith']: cam.data.ortho_scale=max(cam.data.ortho_scale,2.55)
    if f in ['pushup','bridge'] or (f=='core' and v=='plank') or (f=='leg_curl' and v=='seated'):
        # 低机位使用长焦透视；正交镜头的下半画面射线会从地面以下出发。
        cam.data.type='PERSP'
        cam.data.sensor_fit='HORIZONTAL'
        cam.data.lens=cam.data.sensor_width*(cam.location-target).length/(cam.data.ortho_scale*768/896)
    scene.render.resolution_x,scene.render.resolution_y=spec['size']
    return {'position':list(cam.location),'target':list(target),'type':cam.data.type,'orthoScale':cam.data.ortho_scale,'lens':cam.data.lens}

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--only',default='all')
    parser.add_argument('--preview',action='store_true')
    parser.add_argument('--motion-only',action='store_true')
    parser.add_argument('--rebuild-base',action='store_true')
    parser.add_argument('--samples',type=int,default=24)
    parser.add_argument('--save-scenes',action='store_true')
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    chosen=SPECS if args.only=='all' else [s for s in SPECS if str(s['index']) in args.only.split(',') or s['id'] in args.only.split(',')]
    rig,body,pants=base(args.rebuild_base); scene=bpy.context.scene
    scene.eevee.taa_render_samples=args.samples; scene.render.fps=24
    scene.frame_start=1; scene.frame_end=72
    scene.render.image_settings.file_format='PNG'; scene.render.image_settings.color_mode='RGB'
    audit=[]
    for spec in chosen:
        start=time.monotonic(); folder=ROOT/'renders'/spec['slug']; folder.mkdir(parents=True,exist_ok=True)
        if args.preview and (folder/'render.json').exists():
            raise RuntimeError(f'{spec["name"]}: a complete render exists; do not overwrite its frames with a partial preview')
        if not args.motion_only:
            (folder/('preview.json' if args.preview else 'render.json')).unlink(missing_ok=True)
        rig.animation_data_clear(); motion=Motion(rig)
        body.data.materials.clear(); pants.data.materials.clear()
        shaded=spec['family'] in ['pushup','bridge'] or (spec['family']=='core' and spec['variant']=='plank') or (spec['family']=='leg_curl' and spec['variant']=='seated') or (spec['family']=='press' and spec['variant']=='close')
        material,red=anatomy.material(spec['muscles'],shaded_emphasis=shaded); body.data.materials.append(material)
        material2,red2=anatomy.material(spec['muscles'],True,shaded); pants.data.materials.append(material2)
        bpy.data.orphans_purge(do_recursive=True)
        poses=[motion.create(spec,i/72) for i in range(73)]
        projection=max(p['projection'] for p in poses)
        closure=max((poses[0]['joints'][s][k]-poses[-1]['joints'][s][k]).length for s in ['L','R'] for k in poses[0]['joints'][s])
        audit.append({'index':spec['index'],'id':spec['id'],'projection':projection,'closure':closure,'worst':serial(max(poses,key=lambda p:p['projection'])) if projection>.00001 else None})
        if args.motion_only:
            print(json.dumps(audit[-1]),flush=True)
            continue
        assert projection<1e-4,(spec['name'],'unreachable target',projection)
        stage=Equipment(spec,poses[0]); camera_info=camera(spec,poses)
        for i,p in enumerate(poses):
            motion.create(spec,i/72)
            for pb in rig.pose.bones:
                for key in ['location','rotation_quaternion','scale']: pb.keyframe_insert(key,frame=i+1)
            stage.update(p,i/72); stage.keyframe(i+1)
            emphasis=p['emphasis']
            color=V((.055,.001,.005)).lerp(V((.66,.004,.015)),emphasis)
            for node in [red,red2]:
                node.outputs[0].default_value=(*color,1); node.outputs[0].keyframe_insert('default_value',frame=i+1)
        scene.frame_set(1)
        scene['Exercise ID']=spec['id']; scene['Exercise name']=spec['name']
        scene['Source']='MakeHuman CC0 core graphical assets, locked source manifest; original procedural motion and equipment'
        scene['Status']='Production candidate, requires output and visual checks'
        actual_error=0.0
        for index in [0,18,36,54,72]:
            scene.frame_set(index+1)
            posed=rig.evaluated_get(bpy.context.evaluated_depsgraph_get())
            for side in ['L','R']:
                for key,bone in [('shoulder','upperarm01'),('elbow','lowerarm01'),('wrist','wrist'),('hip','upperleg01'),('knee','lowerleg01'),('ankle','foot')]:
                    actual=posed.matrix_world@posed.pose.bones[f'{bone}.{side}'].head
                    actual_error=max(actual_error,(actual-poses[index]['joints'][side][key]).length)
        assert actual_error<1e-5,(spec['name'],actual_error)
        scene.frame_set(1)
        (folder/'motion.json').write_text(json.dumps({'spec':spec,'camera':camera_info,'projection':projection,'closure':closure,'frames':[serial(p) for p in poses]},ensure_ascii=False),encoding='utf-8')
        if args.save_scenes:
            path=ROOT/'cache/scenes'/f'{spec["slug"]}.blend'; path.parent.mkdir(exist_ok=True)
            bpy.ops.wm.save_as_mainfile(filepath=str(path),compress=True)
        indices=[0,18,36,54] if args.preview else range(72)
        for i in indices:
            scene.frame_set(i+1); scene.render.filepath=str(folder/f'{i:03d}.png')
            bpy.ops.render.render(write_still=True)
        (folder/('preview.json' if args.preview else 'render.json')).write_text(json.dumps({'index':spec['index'],'id':spec['id'],'frames':list(indices),'elapsedSeconds':time.monotonic()-start,'samples':args.samples,'projection':projection,'closure':closure,'actualJointErrorM':actual_error,'styleRevision':anatomy.STYLE_REVISION,'completeAnimation':not args.preview},indent=2),encoding='utf-8')
        print(f'DONE {spec["index"]:02d}/80 {spec["slug"]} {time.monotonic()-start:.1f}s',flush=True)
        stage.remove()
    if args.motion_only: (ROOT/'cache/motion-audit.json').write_text(json.dumps(audit,indent=2),encoding='utf-8')

if __name__=='__main__': main()
