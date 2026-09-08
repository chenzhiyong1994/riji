"""串行使用 GPU，编码与后续渲染重叠；每项落盘后才能被恢复跳过。"""
import argparse, concurrent.futures, importlib, json, subprocess, sys, threading, os, shutil
from pathlib import Path
from specs import ROOT,SPECS
encoder=importlib.import_module('export')
BLENDER=os.environ.get('BLENDER_BIN') or shutil.which('blender')
if not BLENDER:
    raise RuntimeError('Set BLENDER_BIN or add Blender 5.2 to PATH')

def encode(spec):
    return encoder.reuse_approved() if spec['index']==53 else encoder.export_one(spec)

def main():
    parser=argparse.ArgumentParser(); parser.add_argument('--only',default='all'); parser.add_argument('--resume',action='store_true'); parser.add_argument('--preview',action='store_true'); parser.add_argument('--encoders',type=int,choices=[1,2],default=2); args=parser.parse_args()
    chosen=SPECS if args.only=='all' else [s for s in SPECS if str(s['index']) in args.only.split(',')]
    failures=[]; pending=[]; (ROOT/'cache/jobs').mkdir(parents=True,exist_ok=True)
    inventory_lock=threading.Lock()
    def encoded(future):
        try: future.result()
        except Exception as exc: print(f'Encoding failed: {exc}',flush=True)
        with inventory_lock: encoder.inventory()
    with concurrent.futures.ProcessPoolExecutor(max_workers=args.encoders) as pool:
        def submit(spec):
            future=pool.submit(encode,spec); pending.append((spec,future)); future.add_done_callback(encoded)
        for spec in chosen:
            target=ROOT/'output'/spec['slug']/'validation.json'
            if args.resume and target.exists():
                data=json.loads(target.read_text(encoding='utf-8'))
                if (data.get('styleRevision')==2 or data.get('status')=='user_approved_reference') and (target.parent/'thumb.webp').exists() and encoder.sha(target.parent/'animation.webp')==data['animation']['sha256']:
                    print(f'SKIP validated {spec["index"]:02d} {spec["name"]}',flush=True); continue
            if spec['index']==53 and not args.preview: submit(spec); continue
            render_folder=ROOT/'renders'/spec['slug']
            if args.resume and not args.preview and (render_folder/'render.json').exists():
                rendered=json.loads((render_folder/'render.json').read_text())
                motion=json.loads((render_folder/'motion.json').read_text(encoding='utf-8'))
                if rendered.get('styleRevision')==2 and rendered.get('completeAnimation') and motion['spec']==spec and all((render_folder/f'{i:03d}.png').exists() for i in range(72)):
                    print(f'ENCODE completed render {spec["index"]:02d} {spec["name"]}',flush=True)
                    submit(spec); continue
            command=[str(BLENDER),'--background','--factory-startup','--python-exit-code','1','--python',str(ROOT/'produce.py'),'--','--only',str(spec['index'])]
            if args.preview: command+=['--preview','--samples','16']
            else: command+=['--save-scenes']
            log=ROOT/'cache/jobs'/f'{spec["index"]:02d}-{"preview" if args.preview else "render"}.log'
            print(f'RENDER {spec["index"]:02d}/80 {spec["name"]}',flush=True)
            (ROOT/'cache/progress.json').write_text(json.dumps({'rendering':spec['index'],'id':spec['id'],'name':spec['name'],'preview':args.preview,'log':str(log)},ensure_ascii=False,indent=2),encoding='utf-8')
            with log.open('w',encoding='utf-8') as stream: result=subprocess.run(command,stdout=stream,stderr=subprocess.STDOUT,creationflags=subprocess.CREATE_NO_WINDOW if sys.platform=='win32' else 0)
            marker=ROOT/'renders'/spec['slug']/('preview.json' if args.preview else 'render.json')
            if result.returncode or not marker.exists():
                failures.append(spec['index']); print(f'FAILED {spec["index"]:02d}: see {log}',flush=True); continue
            if not args.preview: submit(spec)
        for spec,future in pending:
            try: future.result()
            except Exception as exc: failures.append(spec['index']); print(f'EXPORT FAILED {spec["index"]:02d} {exc}',flush=True)
    encoder.inventory()
    print(json.dumps({'done':not failures,'failures':failures,'expectedInBatch':len(chosen)}),flush=True)
    if failures: raise SystemExit(1)

if __name__=='__main__': main()
