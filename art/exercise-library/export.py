"""编码完整动态 WebP，输出关键姿势、逐项校验及可审阅清单。"""
import argparse, hashlib, json, math, shutil, os
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageChops, ImageStat
from specs import SPECS, ROOT

OUT=ROOT/'output'
def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def font(size):
    candidates = [os.environ.get('RIJI_FONT', ''), 'C:/Windows/Fonts/msyh.ttc', '/System/Library/Fonts/PingFang.ttc', '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc']
    for candidate in candidates:
        if candidate and Path(candidate).is_file():
            return ImageFont.truetype(candidate, size)
    raise RuntimeError('Set RIJI_FONT to a Chinese-capable TTF/TTC/OTF font for contact sheets')

def atomic_text(path,value):
    pending=path.with_name(path.name+'.pending')
    pending.write_text(value,encoding='utf-8'); pending.replace(path)

def red_value(image):
    a=np.array(image.convert('RGB'),dtype=np.float32)
    mask=(a[:,:,0]>a[:,:,1]*1.45)&(a[:,:,0]>a[:,:,2]*1.40)&(a[:,:,0]>65)
    return {'pixels':int(mask.sum()),'meanRed':float(a[:,:,0][mask].mean()) if mask.any() else 0}

def keyframes(spec,frames,path):
    canvas=Image.new('RGB',(768,968),'#edf1ed'); draw=ImageDraw.Draw(canvas)
    for col,index in enumerate([0,18,36,54]):
        x=(col%2)*384; y=(col//2)*484
        draw.text((x+12,y+8),f'{spec["index"]:02d} {spec["name"]} · {index/24:.2f}s',font=font(17),fill='#254237')
        canvas.paste(frames[index].resize((384,448),Image.Resampling.LANCZOS),(x,y+36))
    canvas.save(path)

def inspect(path,effort_phase='forward'):
    with Image.open(path) as im:
        assert getattr(im,'is_animated',False) and im.n_frames==72,(path,im.n_frames)
        assert im.info.get('loop')==0
        duration=0; unique=set(); decoded=[]
        for i in range(im.n_frames):
            im.seek(i); frame=im.convert('RGB'); decoded.append(frame.copy())
            unique.add(hashlib.sha256(frame.tobytes()).hexdigest()); duration+=im.info.get('duration',0)
        assert duration==3000,(path,duration)
        assert len(unique)>=60,(path,len(unique))
        red=[red_value(decoded[i]) for i in ([54,18] if effort_phase=='return' else [18,54])]
        assert min(p['pixels'] for p in red)>100,(path,red)
        assert red[0]['meanRed']-red[1]['meanRed']>12,(path,red)
        loop=sum(ImageStat.Stat(ImageChops.difference(decoded[0],decoded[-1])).mean)/3
        largest=max(sum(ImageStat.Stat(ImageChops.difference(decoded[0],decoded[i])).mean)/3 for i in [18,36,54])
        assert loop<max(.75,largest*.45),(path,loop,largest)
        return {'frames':72,'uniqueFrames':len(unique),'durationMs':duration,'loop':0,'size':list(im.size),'bytes':path.stat().st_size,'sha256':sha(path),'redChecks':red,'loopPixelDelta':loop,'largestPosePixelDelta':largest}

def export_one(spec):
    folder=ROOT/'renders'/spec['slug']; report=folder/'render.json'
    assert report.exists(),f'{spec["name"]}: full render marker absent'
    record=json.loads(report.read_text())
    assert record['completeAnimation'] and record['frames']==list(range(72))
    motion=json.loads((folder/'motion.json').read_text(encoding='utf-8'))
    assert spec['id']==motion['spec']['id']
    spec=motion['spec']
    assert motion['projection']<1e-4,(spec['name'],'unreachable joint target',motion['projection'])
    assert motion['closure']<1e-5
    frames=[Image.open(folder/f'{i:03d}.png').convert('RGB') for i in range(72)]
    assert all(list(im.size)==spec['size'] for im in frames)
    target=OUT/spec['slug']; target.mkdir(parents=True,exist_ok=True)
    animation=target/'animation.webp'
    pending=target/'animation.pending.webp'
    frames[0].save(pending,save_all=True,append_images=frames[1:],duration=[41,42,42]*24,loop=0,quality=89,method=6)
    animation_info=inspect(pending,spec.get('effortPhase','forward'))
    pending.replace(animation)
    poster=frames[54 if spec.get('effortPhase')=='return' else 18]
    poster.save(target/'poster.webp',quality=91,method=6)
    poster.resize((160,186),Image.Resampling.LANCZOS).save(target/'thumb.webp',quality=85,method=6)
    keyframes(spec,frames,target/'keyframes.jpg')
    result={'id':spec['id'],'name':spec['name'],'index':spec['index'],'slug':spec['slug'],'muscles':spec['muscles'],'effortPhase':spec.get('effortPhase','forward'),'status':'encoded_pending_visual_review','animation':animation_info,'poster':{'sha256':sha(target/'poster.webp'),'bytes':(target/'poster.webp').stat().st_size},'thumb':{'sha256':sha(target/'thumb.webp'),'bytes':(target/'thumb.webp').stat().st_size,'size':[160,186]},'motion':{'projectionMaxM':motion['projection'],'loopJointErrorM':motion['closure']}}
    result['motion']['actualJointErrorM']=record['actualJointErrorM']
    result['styleRevision']=record['styleRevision']
    result['userReview']='pending'
    atomic_text(target/'validation.json',json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'index':spec['index'],'id':spec['id'],'bytes':result['animation']['bytes'],'validated':True}),flush=True)
    return result

def reuse_approved():
    spec=SPECS[52]; assert spec['id']=='dumbbellcurl'
    source=ROOT.parent/'muscle-preview/refined-curl'; target=OUT/spec['slug']; target.mkdir(parents=True,exist_ok=True)
    shutil.copy2(source/'refined-curl.webp',target/'animation.webp')
    Image.open(source/'poster.png').save(target/'poster.webp',quality=91,method=6)
    Image.open(source/'poster.png').resize((160,186),Image.Resampling.LANCZOS).save(target/'thumb.webp',quality=85,method=6)
    frames={i:Image.open(source/'reference-frames'/f'{i:03d}.png').convert('RGB') for i in [0,18,36,54]}
    keyframes(spec,frames,target/'keyframes.jpg')
    scene=json.loads((source/'scene-validation.json').read_text())
    result={'id':spec['id'],'name':spec['name'],'index':53,'slug':spec['slug'],'muscles':spec['muscles'],'status':'user_approved_reference','sourceApprovedSample':'../muscle-preview/refined-curl','animation':inspect(target/'animation.webp'),'poster':{'sha256':sha(target/'poster.webp'),'bytes':(target/'poster.webp').stat().st_size},'motion':{'projectionMaxM':0,'loopJointErrorM':scene['evaluated_surface_loop_error_m'],'actualJointErrorM':scene['actual_scene_joint_error_m']}}
    result['thumb']={'sha256':sha(target/'thumb.webp'),'bytes':(target/'thumb.webp').stat().st_size,'size':[160,186]}
    result['userReview']='pending'
    assert sha(target/'animation.webp')==sha(source/'refined-curl.webp')
    atomic_text(target/'validation.json',json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    return result

def inventory():
    records=[]; gallery=[]
    for spec in SPECS:
        path=OUT/spec['slug']/'validation.json'; result=None
        if path.exists(): result=json.loads(path.read_text(encoding='utf-8')); records.append(result)
        preview=ROOT/'renders'/spec['slug']/'018.png'
        gallery.append({**spec,'encoded':bool(result),'animationSha256':result['animation']['sha256'] if result else None,
          'poster':f'output/{spec["slug"]}/poster.webp' if result else f'renders/{spec["slug"]}/018.png' if preview.exists() else None,
          'animation':f'output/{spec["slug"]}/animation.webp' if result else None})
    packaged=ROOT.parent.parent/'app/src/main/assets/animation-manifest.json'
    imported=json.loads(packaged.read_text(encoding='utf-8')) if packaged.exists() else {}
    hashes={f['exerciseId']:f['sha256'] for f in imported.get('files',[]) if f['kind']=='animation'}
    integrated=len(records)==80 and all(hashes.get(r['id'])==r['animation']['sha256'] for r in records)
    manifest={'expected':80,'encoded':len(records),'integrated':integrated,'poseAcceptance':'pending_user_review','items':records}
    OUT.mkdir(exist_ok=True)
    atomic_text(OUT/'manifest.json',json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    atomic_text(ROOT/'gallery-data.js','window.LIBRARY_PREVIEW = '+json.dumps(gallery,ensure_ascii=False)+';\n')
    return manifest

def contacts():
    OUT.mkdir(exist_ok=True)
    for start in range(0,80,10):
        canvas=Image.new('RGB',(1280,1110),'#edf1ed'); draw=ImageDraw.Draw(canvas)
        for k,spec in enumerate(SPECS[start:start+10]):
            x=(k%5)*256; y=(k//5)*555; draw.text((x+10,y+10),f'{spec["index"]:02d} {spec["name"]}',font=font(17),fill='#254237')
            for row,index in enumerate([0,36]):
                p=ROOT/'renders'/spec['slug']/f'{index:03d}.png'
                if spec['index']==53: p=ROOT.parent/'muscle-preview/refined-curl/renders'/f'{index:03d}.png'
                if p.exists(): canvas.paste(Image.open(p).convert('RGB').resize((224,261),Image.Resampling.LANCZOS),(x+16,y+28+row*261))
        canvas.save(OUT/f'contact-{start+1:02d}-{start+10:02d}.jpg',quality=93)
    inventory()

def main():
    parser=argparse.ArgumentParser(); parser.add_argument('--only',default='all'); parser.add_argument('--contacts',action='store_true'); args=parser.parse_args()
    if args.contacts: contacts(); return
    selected=SPECS if args.only=='all' else [s for s in SPECS if str(s['index']) in args.only.split(',')]
    for spec in selected:
        if spec['index']==53: reuse_approved()
        else: export_one(spec)
    inventory()

if __name__=='__main__': main()
