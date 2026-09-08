"""80 个现役动作的独立制作规格；动作 ID 与 App 保持一一对应。"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
APP = ROOT.parents[1] / 'app/src/main/assets'
CATALOG = json.loads((APP/'catalog.js').read_text(encoding='utf-8').split('=', 1)[1].strip().removesuffix(';'))

# family, variant, apparatus, main/secondary surface groups, view
ROWS = [
 ('press','flat','barbell','chest:1 triceps:.55 front_delts:.45','front'),
 ('press','flat','dumbbells','chest:1 triceps:.45 front_delts:.4','front'),
 ('press','incline','dumbbells','chest:1 front_delts:.65 triceps:.45','front'),
 ('press','incline','barbell','chest:1 front_delts:.65 triceps:.45','front'),
 ('press','seated','chest-machine','chest:1 triceps:.5 front_delts:.4','front'),
 ('press','flat','smith','chest:1 triceps:.55 front_delts:.4','front'),
 ('fly','supine','dumbbells','chest:1 front_delts:.35','front'),
 ('fly','seated','pec-deck','chest:1 front_delts:.3','front'),
 ('fly','standing','dual-cable','chest:1 front_delts:.3','front'),
 ('dip','forward','dip-bars','chest:1 triceps:.85 front_delts:.35','front'),
 ('pushup','full','mat','chest:1 triceps:.65 front_delts:.4 abs:.25','front'),
 ('pushup','knees','mat','chest:1 triceps:.65 front_delts:.4','front'),
 ('pulldown','wide','lat-machine','lats:1 biceps:.55 upper_back:.5','back'),
 ('pulldown','close','lat-machine','lats:1 biceps:.65 upper_back:.4','back'),
 ('row','bent','barbell','lats:.8 upper_back:1 biceps:.5','back'),
 ('row','single','dumbbell-bench','lats:1 upper_back:.7 biceps:.5','back'),
 ('row','seated','row-cable','lats:1 upper_back:.8 biceps:.5','back'),
 ('pulldown','neutral','lever-lat','lats:1 biceps:.55 upper_back:.5','back'),
 ('row','supported','row-machine','lats:.85 upper_back:1 biceps:.5','back'),
 ('row','tbar','tbar','upper_back:1 lats:.8 biceps:.5','back'),
 ('pullup','wide','pullup-bar','lats:1 biceps:.6 upper_back:.5','back'),
 ('pullup','underhand','pullup-bar','lats:1 biceps:.8 upper_back:.5','back'),
 ('pullup','assisted','assisted-pullup','lats:1 biceps:.6 upper_back:.5','back'),
 ('straight_pull','standing','high-cable','lats:1 triceps:.25','back'),
 ('squat','back','barbell','quads:1 glutes:.85 erectors:.3','front'),
 ('hinge','deadlift','barbell','glutes:1 hamstrings:.8 quads:.65 erectors:.5','back'),
 ('hinge','sumo','barbell','glutes:1 adductors:.8 quads:.8 hamstrings:.45','front'),
 ('hinge','romanian','barbell','hamstrings:1 glutes:.85 erectors:.35','back'),
 ('squat','hack','hack-machine','quads:1 glutes:.6','front'),
 ('squat','smith','smith','quads:1 glutes:.8','front'),
 ('squat','front','barbell','quads:1 glutes:.65 abs:.25','front'),
 ('squat','goblet','goblet','quads:1 glutes:.65','front'),
 ('leg_curl','lying','lying-curl','hamstrings:1 calves:.35','back'),
 ('leg_curl','seated','seated-curl','hamstrings:1 calves:.3','back'),
 ('leg_extension','seated','leg-extension','quads:1','front'),
 ('leg_press','incline','leg-press','quads:1 glutes:.8','front'),
 ('lunge','barbell','barbell','quads:1 glutes:.85','front'),
 ('squat','bodyweight','none','quads:1 glutes:.8','front'),
 ('bridge','bench','hip-barbell','glutes:1 hamstrings:.4','back'),
 ('bridge','bench','hip-smith','glutes:1 hamstrings:.4','back'),
 ('hip_machine','abduction','hip-machine','abductors:1 glutes:.55','back'),
 ('hip_machine','adduction','hip-machine','adductors:1','front'),
 ('bridge','floor','mat','glutes:1 hamstrings:.4','back'),
 ('overhead','seated','dumbbells','front_delts:1 side_delts:.8 triceps:.55','front'),
 ('raise','lateral','dumbbells','side_delts:1 front_delts:.25','front'),
 ('raise','front','dumbbells','front_delts:1','front'),
 ('raise','reverse','dumbbells','rear_delts:1 upper_back:.65','back'),
 ('overhead','standing','barbell','front_delts:1 side_delts:.7 triceps:.6','front'),
 ('overhead','seated','shoulder-machine','front_delts:1 side_delts:.8 triceps:.6','front'),
 ('raise','pec-reverse','reverse-deck','rear_delts:1 upper_back:.6','back'),
 ('overhead','arnold','dumbbells','front_delts:1 side_delts:.8 triceps:.5','front'),
 ('face_pull','standing','high-cable','rear_delts:1 upper_back:.85','back'),
 ('curl','supinated','dumbbells','biceps:1','front'),
 ('curl','supinated','barbell','biceps:1','front'),
 ('curl','hammer','dumbbells','biceps:.85 forearms:.65','front'),
 ('curl','preacher','preacher-bar','biceps:1','front'),
 ('curl','cable','low-cable','biceps:1','front'),
 ('curl','incline','dumbbells','biceps:1','front'),
 ('triceps','overhead','single-dumbbell','triceps:1','back'),
 ('triceps','rope','high-cable','triceps:1','back'),
 ('triceps','overhead-cable','high-cable','triceps:1','back'),
 ('triceps','vbar','high-cable','triceps:1','back'),
 ('triceps','skull','barbell','triceps:1','back'),
 ('press','close','barbell','triceps:1 chest:.65 front_delts:.35','back'),
 ('calf','standing','dumbbells','calves:1','back'),
 ('calf','standing','none','calves:1','back'),
 ('calf','seated','calf-machine','calves:1','back'),
 ('core','crunch','mat','abs:1','front'),
 ('core','leg-raise','mat','abs:1 hip_flexors:.55','front'),
 ('core','plank','mat','abs:1 obliques:.5','front'),
 ('core','cable-crunch','high-cable','abs:1','front'),
 ('core','hanging-raise','pullup-bar','abs:1 hip_flexors:.65','front'),
 ('core','dead-bug','mat','abs:1 obliques:.35','front'),
 ('core','side-plank','mat','obliques:1 abductors:.4','front'),
 ('cardio','run','treadmill','quads:.8 hamstrings:.7 calves:1 glutes:.7','front'),
 ('cardio','cycle','bike','quads:1 glutes:.7 calves:.55','front'),
 ('cardio','row','rower','quads:1 glutes:.7 lats:.8 upper_back:.6','back'),
 ('cardio','elliptical','elliptical','quads:1 glutes:.8 calves:.6','front'),
 ('cardio','stairs','stepmill','quads:1 glutes:1 calves:.6','back'),
 ('cardio','incline-walk','treadmill','glutes:1 calves:.9 quads:.65','back'),
]
assert len(ROWS) == len(CATALOG) == 80
SPECS = []
for i, (entry, row) in enumerate(zip(CATALOG, ROWS)):
    family, variant, apparatus, muscles, view = row
    SPECS.append({'index':i+1,'id':entry['id'],'name':entry['name'],'category':entry['category'],
      'slug':f'{i+1:02d}-{family}-{variant}-{apparatus}','family':family,'variant':variant,
      'apparatus':apparatus,'muscles':{k:float(v) for k,v in (pair.split(':') for pair in muscles.split())},
      'view':view,'effortPhase':'return' if family in ['squat','hinge','lunge','dip'] else 'forward','frames':72,'fps':24,'durationMs':3000,'size':[768,896]})

if __name__ == '__main__':
    (ROOT/'specs.json').write_text(json.dumps(SPECS,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(f'{len(SPECS)} specifications')
