"""在已批准的连续网格上增加贴合蒙皮的肌群分区。"""
import sys
from pathlib import Path
import bpy
import numpy as np

ROOT=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT.parent/'muscle-preview/refined-curl'))
import build_refined as ref

GROUPS=['chest','biceps','triceps','front_delts','side_delts','rear_delts','forearms','lats','upper_back','erectors','abs','obliques','quads','hamstrings','glutes','abductors','adductors','calves','hip_flexors']
STYLE_REVISION=2

def smooth(a,b,x):
    t=np.clip((x-a)/(b-a),0,1)
    return t*t*(3-2*t)

def band(a,b,x,edge=.015):
    return smooth(a,a+edge,x)*(1-smooth(b-edge,b,x))

def prepare_mesh(obj,rig):
    n=len(obj.data.vertices)
    co=np.zeros(n*3,dtype=np.float32)
    obj.data.vertices.foreach_get('co',co)
    co=co.reshape((-1,3)); x,y,z=co.T; ax=np.abs(x)
    front=1-smooth(-.02,.01,y); back=smooth(.015,.05,y)
    masks={k:np.zeros(n,dtype=np.float32) for k in GROUPS}
    # 胸大肌呈扇形，腹直肌分节，脊柱和左右背部留出柔和分界。
    pec=1.0-((ax-.095)/.12)**2-((z-1.365)/.105)**2
    masks['chest']=smooth(-.05,.12,pec)*front*smooth(.008,.018,ax)
    masks['abs']=band(1.045,1.285,z)* (1-smooth(.059,.083,ax))*front*smooth(.003,.009,ax)
    for level in [1.10,1.17,1.235]:
        masks['abs']*=.55+.45*smooth(.001,.005,np.abs(z-level))
    masks['obliques']=band(1.025,1.29,z)*band(.078,.162,ax)*front
    masks['lats']=band(1.11,1.395,z)*band(.06,.208,ax)*back
    masks['upper_back']=band(1.325,1.52,z)*band(.018,.195,ax)*back
    masks['erectors']=band(1.00,1.34,z)*band(.018,.061,ax,.012)*back
    masks['glutes']=band(.86,1.035,z)*band(.026,.177,ax)*back
    masks['abductors']=band(.855,1.018,z)*band(.135,.208,ax,.012)
    masks['hip_flexors']=band(.88,1.048,z)*band(.045,.137,ax)*front
    for side in ['L','R']:
        for region,first,last,rad in [('arm','upperarm01','lowerarm01',.098),('forearm','lowerarm01','wrist',.068),('thigh','upperleg01','lowerleg01',.142),('calf','lowerleg01','foot',.087)]:
            a=np.array(rig.data.bones[f'{first}.{side}'].head_local)
            b=np.array(rig.data.bones[f'{last}.{side}'].head_local)
            direction=(b-a)/np.linalg.norm(b-a)
            f=np.array([0.,-1.,0.]); f-=direction*np.dot(f,direction); f/=np.linalg.norm(f)
            lateral=np.cross(direction,f)
            delta=co-a; t=delta@direction/np.linalg.norm(b-a)
            radial=delta-(delta@direction)[:,None]*direction
            radius=np.linalg.norm(radial,axis=1)
            angle=np.arctan2(radial@lateral,radial@f)
            envelope=(1-smooth(rad*.92,rad,radius))
            if region=='arm':
                main=band(.24,.93,t,.1)*envelope
                biceps=(1-smooth(.8,1.08,((t-.58)/.39)**2+(angle/.86)**2))*envelope
                masks['biceps']=np.maximum(masks['biceps'],biceps)
                tri=main*smooth(1.3,1.75,np.abs(angle))
                tri*=.60+.40*smooth(.02,.08,np.abs(np.abs(angle)-2.65))
                masks['triceps']=np.maximum(masks['triceps'],tri)
                sign=1 if side=='L' else -1
                # 三角肌位于肩部外侧；不把内侧腋窝也当作中束。
                for key,center,spread in [('front_delts',-.40*sign,.86),('side_delts',-1.55*sign,.76),('rear_delts',-2.65*sign,.72)]:
                    angular=np.arctan2(np.sin(angle-center),np.cos(angle-center))
                    ellipse=((t-.015)/.38)**2+(angular/spread)**2
                    masks[key]=np.maximum(masks[key],(1-smooth(.80,1.08,ellipse))*envelope)
            elif region=='forearm':
                masks['forearms']=np.maximum(masks['forearms'],band(.13,.74,t,.15)*envelope*(1-smooth(1.5,2.1,np.abs(angle))))
            elif region=='thigh':
                main=band(.13,.92,t,.10)*envelope
                quad=main*(1-smooth(1.4,1.85,np.abs(angle)))
                # 股直肌和股内/外侧肌之间留细分界，保持连续表面。
                quad*=.60+.40*smooth(.015,.075,np.abs(np.abs(angle)-.64))
                masks['quads']=np.maximum(masks['quads'],quad)
                masks['hamstrings']=np.maximum(masks['hamstrings'],main*smooth(1.65,2.12,np.abs(angle)))
                inward=(radial[:,0]*(1 if side=='R' else -1))
                masks['adductors']=np.maximum(masks['adductors'],band(.1,.75,t,.1)*envelope*smooth(.018,.062,inward))
            else:
                calf=band(.18,.79,t,.13)*envelope*smooth(1.42,1.85,np.abs(angle))
                calf*=.6+.4*smooth(.01,.05,np.abs(np.abs(angle)-2.86))
                masks['calves']=np.maximum(masks['calves'],calf)
    for key,values in masks.items():
        attr=obj.data.attributes.get('Muscle_'+key) or obj.data.attributes.new('Muscle_'+key,'FLOAT','POINT')
        attr.data.foreach_set('value',np.clip(values,0,1).astype(np.float32))
    # 额外解剖细节通过同一平滑分区生成，避免高亮外的表面完全平坦。
    attr=obj.data.attributes.get('AnatomyLine')
    values=np.zeros(n,dtype=np.float32)
    if attr: attr.data.foreach_get('value',values)
    for key in ['chest','lats','quads','hamstrings','calves','triceps']:
        mask=masks[key]
        values=np.maximum(values,(1-smooth(.035,.13,np.abs(mask-.45)))*.18)
    attr.data.foreach_set('value',values)

def material(weights,shorts=False,shaded_emphasis=False):
    mat,red=ref.surface_material()
    mat.name='Library anatomy'+(' / fabric overlay' if shorts else '')
    nodes,links=mat.node_tree.nodes,mat.node_tree.links
    old=next(n for n in nodes if n.type=='ATTRIBUTE' and n.attribute_name=='BicepsMask')
    dest=[link.to_socket for link in list(old.outputs['Fac'].links)]
    for link in list(old.outputs['Fac'].links): links.remove(link)
    total=None
    for group,weight in weights.items():
        a=nodes.new('ShaderNodeAttribute'); a.attribute_name='Muscle_'+group
        mul=nodes.new('ShaderNodeMath'); mul.operation='MULTIPLY'; mul.inputs[1].default_value=weight
        links.new(a.outputs['Fac'],mul.inputs[0])
        if total is None: total=mul.outputs[0]
        else:
            node=nodes.new('ShaderNodeMath'); node.operation='MAXIMUM'
            links.new(total,node.inputs[0]); links.new(mul.outputs[0],node.inputs[1]); total=node.outputs[0]
    for socket in dest: links.new(total,socket)
    if shaded_emphasis:
        # 低机位看到的是受遮蔽的躯干下侧，用温和的自发光保留红色指示。
        bsdf=nodes.get('Principled BSDF')
        strength=nodes.new('ShaderNodeMath'); strength.operation='MULTIPLY'; strength.inputs[1].default_value=.40
        links.new(total,strength.inputs[0]); links.new(strength.outputs[0],bsdf.inputs['Emission Strength'])
        links.new(red.outputs[0],bsdf.inputs['Emission Color'])
    if shorts:
        for n in nodes:
            if n.type=='MIX_RGB' and tuple(round(x,3) for x in n.inputs[1].default_value[:3])==(.37,.425,.43):
                n.inputs[1].default_value=(.065,.095,.11,1)
                n.inputs[2].default_value=(.035,.052,.06,1)
    return mat,red

def load_base():
    bpy.ops.wm.open_mainfile(filepath=str(ROOT.parent/'muscle-preview/refined-curl/refined-curl.blend'))
    for obj in list(bpy.data.objects):
        if obj.name.startswith(('Dumbbell','L /','R /')):
            bpy.data.objects.remove(obj,do_unlink=True)
    rig=bpy.data.objects['Exercise rig']; body=bpy.data.objects['Athletic male / continuous skinned surface']; pants=bpy.data.objects['Graphite compression shorts']
    rig.animation_data_clear()
    for obj in [body,pants]:
        if obj.data.shape_keys:
            obj.data.shape_keys.animation_data_clear()
            for key in obj.data.shape_keys.key_blocks: key.value=0
        obj.modifiers['Final surface smoothing'].show_render=False
        prepare_mesh(obj,rig)
    for bone in rig.pose.bones:
        bone.matrix_basis.identity()
    return rig,body,pants
