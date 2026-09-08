"""MakeHuman CC0 连续人体网格 + 原创弯举、肌群表面分区和灯光。

只读取锁定的图形资产；不执行上游 Python 或插件。保留上一轮人偶样片。
"""
import argparse
import json
import math
from pathlib import Path
import sys

import bmesh
import bpy
from mathutils import Vector, Matrix, Quaternion

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "source" / "makehuman"
sys.path.insert(0, str(ROOT.parent))
import build_scenes as studio

V = Vector
FRAMES, FPS = 72, 24
UP, FRONT = V((0, 0, 1)), V((0, -1, 0))


def smooth(a, b, value):
    t = max(0, min(1, (value-a)/(b-a)))
    return t*t*(3-2*t)


def load_asset():
    verts, faces, group = [], [], None
    for line in (SOURCE / "base.obj").read_text(encoding="utf-8").splitlines():
        fields = line.split()
        if not fields:
            continue
        if fields[0] == "v":
            verts.append(V(tuple(map(float, fields[1:4]))))
        elif fields[0] == "g":
            group = fields[1]
        elif fields[0] == "f" and group == "body":
            faces.append(tuple(int(value.split("/")[0])-1 for value in fields[1:]))
    for filename, weight in [
        ("caucasian-male-young.target", 1/3),
        ("asian-male-young.target", 1/3),
        ("african-male-young.target", 1/3),
        ("universal-male-young-maxmuscle-averageweight.target", .90),
    ]:
        for line in (SOURCE / filename).read_text(encoding="utf-8").splitlines():
            if not line or line.startswith("#"):
                continue
            index, *delta = line.split()
            verts[int(index)] += V(tuple(map(float, delta)))*weight
    used = sorted({i for face in faces for i in face})
    low, high = min(verts[i].y for i in used), max(verts[i].y for i in used)
    scale = 1.80/(high-low)
    verts = [V((p.x*scale, -p.z*scale, (p.y-low)*scale)) for p in verts]
    skeleton = json.loads((SOURCE / "default.mhskel").read_text(encoding="utf-8"))
    weights = json.loads((SOURCE / "default_weights.mhw").read_text(encoding="utf-8"))["weights"]
    joints = {name: sum((verts[i] for i in indices), V())/len(indices) for name, indices in skeleton["joints"].items()}
    return verts, faces, skeleton, weights, joints


def create_body_rig(verts, faces, skeleton, weights, joints):
    mesh = bpy.data.meshes.new("MakeHuman CC0 / continuous body")
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    body = bpy.data.objects.new("Athletic male / continuous skinned surface", mesh)
    bpy.context.collection.objects.link(body)
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    for name, data in weights.items():
        group = body.vertex_groups.new(name=name)
        for index, weight in data:
            group.add([index], weight, "REPLACE")
    # 丢弃仅服务于导入定位的孤立 helper 顶点，保留已有顶点权重。
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
    bm.to_mesh(mesh)
    bm.free()
    arm = bpy.data.armatures.new("MakeHuman CC0 / 163 bone skeleton")
    rig = bpy.data.objects.new("Exercise rig", arm)
    bpy.context.collection.objects.link(rig)
    bpy.context.view_layer.objects.active = rig
    rig.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    for name, data in skeleton["bones"].items():
        bone = arm.edit_bones.new(name)
        bone.head, bone.tail = joints[data["head"]], joints[data["tail"]]
        bone.align_roll(FRONT)
    for name, data in skeleton["bones"].items():
        if data["parent"]:
            arm.edit_bones[name].parent = arm.edit_bones[data["parent"]]
    bpy.ops.object.mode_set(mode="OBJECT")
    rig.select_set(False)
    # 先细分静止网格再绘制肌肉区域，使分区边界有足够采样密度。
    bpy.context.view_layer.objects.active = body
    body.select_set(True)
    subdiv = body.modifiers.new("Rest surface refinement", "SUBSURF")
    subdiv.levels = 2
    bpy.ops.object.modifier_apply(modifier=subdiv.name)
    deform = body.modifiers.new("Continuous skin deformation", "ARMATURE")
    deform.object = rig
    deform.use_deform_preserve_volume = True
    subdiv = body.modifiers.new("Final surface smoothing", "SUBSURF")
    subdiv.levels = 1
    subdiv.render_levels = 1
    body.select_set(False)
    return body, rig


def region_attributes(body, rig):
    attrs = {name: body.data.attributes.new(name, "FLOAT", "POINT") for name in ["BicepsMask", "AnatomyLine", "BicepsDivision"]}
    rest = body.data.attributes.new("RestPosition", "FLOAT_VECTOR", "POINT")
    arms = []
    for side in ["L", "R"]:
        a, b = rig.data.bones[f"upperarm01.{side}"].head_local, rig.data.bones[f"lowerarm01.{side}"].head_local
        direction = (b-a).normalized()
        front = (FRONT-direction*FRONT.dot(direction)).normalized()
        across = direction.cross(front).normalized()
        arms.append((a.copy(), b.copy(), direction, front, across))
    for vertex in body.data.vertices:
        p = vertex.co
        rest.data[vertex.index].vector = p
        mask, division, detail = 0.0, 0.0, 0.0
        for a, b, direction, front, across in arms:
            length = (b-a).length
            t = (p-a).dot(direction)/length
            radial = p-a-direction*(p-a).dot(direction)
            anterior, lateral = radial.dot(front), radial.dot(across)
            if -.1 < t < 1.25 and radial.length < .105:
                angle = math.atan2(lateral, anterior)
                # 贴合网格的梭形二头肌，向两端逐渐收窄；长短头之间留细窄分界。
                ellipse = ((t-.58)/.39)**2+(angle/.86)**2
                mask = max(mask, 1-smooth(.83, 1.06, ellipse))
                line_at = .025+.065*math.sin(t*math.pi)
                division = max(division, (1-smooth(.018, .055, abs(angle-line_at)))*smooth(.25, .35, t)*(1-smooth(.79, .91, t)))
                # 肩峰到三角肌边缘、外侧肱肌的柔和分界。
                shoulder_line = (1-smooth(.012, .047, abs(t-(.20+.10*math.cos(angle)))))*(1-smooth(1.7, 2.0, abs(angle)))
                side_line = (1-smooth(.018, .065, abs(abs(angle)-1.32)))*smooth(.24, .40, t)*(1-smooth(.84, 1, t))
                detail = max(detail, shoulder_line*.55, side_line*.45)
        # 细淡的胸肌下缘、腹白线、腹肌腱划，不把人体切成悬浮块。
        if abs(p.x) < .215 and 1.035 < p.z < 1.48 and p.y < -.035:
            chest_border = 1.275+.06*(abs(p.x)/.19)**1.4
            pec = (1-smooth(.0015, .0055, abs(p.z-chest_border)))*smooth(.02, .04, abs(p.x))*(1-smooth(.16, .20, abs(p.x)))
            sternum = (1-smooth(.001, .004, abs(p.x)))*smooth(1.10, 1.15, p.z)*(1-smooth(1.41, 1.44, p.z))
            ab_borders = min(abs(p.z-z) for z in [1.10, 1.17, 1.235])
            abs_line = (1-smooth(.001, .0045, ab_borders))*(1-smooth(.055, .074, abs(p.x)))
            detail = max(detail, pec*.55, sternum*.35, abs_line*.38)
        attrs["BicepsMask"].data[vertex.index].value = mask
        attrs["BicepsDivision"].data[vertex.index].value = division
        attrs["AnatomyLine"].data[vertex.index].value = detail


def surface_material():
    mat = bpy.data.materials.new("Anatomy / pearl graphite with surface muscle emphasis")
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    bsdf = nodes.get("Principled BSDF")
    bsdf.inputs["Roughness"].default_value = .59
    bsdf.inputs["Specular IOR Level"].default_value = .27
    def attr(name):
        node = nodes.new("ShaderNodeAttribute")
        node.attribute_name = name
        return node
    def mix(factor, a, b):
        node = nodes.new("ShaderNodeMixRGB")
        links.new(factor, node.inputs[0])
        node.inputs[1].default_value, node.inputs[2].default_value = a, b
        return node
    lines, mask, split = attr("AnatomyLine"), attr("BicepsMask"), attr("BicepsDivision")
    skin = mix(lines.outputs["Fac"], (.37, .425, .43, 1), (.16, .205, .21, 1))
    color = nodes.new("ShaderNodeRGB")
    color.name = "Dynamic red"
    red = mix(split.outputs["Fac"], (.5, .004, .012, 1), (.055, .008, .012, 1))
    links.new(color.outputs[0], red.inputs[1])
    final = mix(mask.outputs["Fac"], (0, 0, 0, 1), (1, 1, 1, 1))
    links.new(skin.outputs[0], final.inputs[1])
    links.new(red.outputs[0], final.inputs[2])
    links.new(final.outputs[0], bsdf.inputs["Base Color"])
    # 轻微纵向纤维纹理随静止坐标蒙皮，不随相机或世界坐标滑动。
    position = attr("RestPosition")
    mapping = nodes.new("ShaderNodeVectorMath")
    mapping.operation = "MULTIPLY"
    mapping.inputs[1].default_value = (190, 190, 18)
    links.new(position.outputs["Vector"], mapping.inputs[0])
    noise = nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 2.0
    noise.inputs["Detail"].default_value = 2.0
    links.new(mapping.outputs["Vector"], noise.inputs["Vector"])
    bump = nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = .12
    bump.inputs["Distance"].default_value = .00045
    links.new(noise.outputs["Fac"], bump.inputs["Height"])
    links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    return mat, color


def add_shorts(body):
    pants = body.copy()
    pants.data = body.data.copy()
    pants.name = "Graphite compression shorts"
    bpy.context.collection.objects.link(pants)
    bm = bmesh.new()
    bm.from_mesh(pants.data)
    for z, normal in [(1.048, (0, 0, 1)), (.745, (0, 0, -1))]:
        bmesh.ops.bisect_plane(bm, geom=list(bm.verts)+list(bm.edges)+list(bm.faces), plane_co=(0, 0, z), plane_no=normal, clear_outer=True, dist=1e-6)
    bm.to_mesh(pants.data)
    bm.free()
    pants.data.materials.clear()
    pants.data.materials.append(studio.material("Shorts / dark woven graphite", (.065, .095, .11), .84))
    solid = pants.modifiers.new("Fabric thickness", "SOLIDIFY")
    solid.thickness, solid.offset = .005, 1
    return pants


def contraction_key(body):
    body.shape_key_add(name="Basis")
    key = body.shape_key_add(name="Subtle biceps contraction")
    mask = body.data.attributes["BicepsMask"].data
    for vertex in body.data.vertices:
        key.data[vertex.index].co += vertex.normal*(.0035*mask[vertex.index].value**2)
    return key


def world_transform(bone, rotation, head):
    return Matrix.Translation(head) @ rotation.to_matrix().to_4x4() @ bone.matrix_local.to_3x3().to_4x4()


def solve_chain(points, target):
    """固定各指节长度的 FABRIK，让指尖落在握柄表面附近。"""
    points = [p.copy() for p in points]
    start = points[0].copy()
    lengths = [(points[i+1]-points[i]).length for i in range(len(points)-1)]
    if (target-start).length >= sum(lengths):
        target = start+(target-start).normalized()*(sum(lengths)-.001)
    for _ in range(24):
        points[-1] = target.copy()
        for i in range(len(lengths)-1, -1, -1):
            points[i] = points[i+1]+(points[i]-points[i+1]).normalized()*lengths[i]
        points[0] = start.copy()
        for i, length in enumerate(lengths):
            points[i+1] = points[i]+(points[i+1]-points[i]).normalized()*length
    return points


def setup_weights():
    metal = studio.material("Dumbbell / brushed metal", (.34, .39, .41), .29, .78)
    rubber = studio.material("Dumbbell / charcoal", (.025, .037, .046), .52, .12)
    accent = studio.material("Dumbbell / mint ring", (.14, .34, .28), .48, .3)
    tools = {}
    for side in ["L", "R"]:
        root = bpy.data.objects.new(f"Dumbbell {side}", None)
        bpy.context.collection.objects.link(root)
        tools[side] = root
        parts = [studio.cylinder(f"{side} / grip", metal, .016, .18)]
        for sign in [-1, 1]:
            parts.append(studio.cylinder(f"{side} / plate", rubber, .080, .048, (sign*.095, 0, 0)))
            parts.append(studio.cylinder(f"{side} / plate ring", accent, .033, .005, (sign*.121, 0, 0)))
        for obj in parts:
            obj.parent = root
    return tools


def animate(rig, tools, red, contraction):
    bones = rig.data.bones
    ordered = []
    def walk(bone):
        ordered.append(bone)
        for child in bone.children:
            walk(child)
    for bone in bones:
        if bone.parent is None:
            walk(bone)
    telemetry = []
    for i in range(FRAMES+1):
        phase = i/FRAMES
        u = (1-math.cos(phase*2*math.pi))/2
        overrides, joint_record = {}, {}
        for side, sign in [("L", 1), ("R", -1)]:
            upper = bones[f"upperarm01.{side}"]
            fore = bones[f"lowerarm01.{side}"]
            wrist = bones[f"wrist.{side}"]
            shoulder, rest_elbow, rest_wrist = upper.head_local, fore.head_local, wrist.head_local
            upper_direction = V((sign*.10, -.10, -1)).normalized()
            q_upper = (rest_elbow-shoulder).rotation_difference(upper_direction)
            elbow = shoulder+q_upper@(rest_elbow-shoulder)
            angle = .22+1.96*u
            fore_direction = V((sign*.055, -math.sin(angle), -math.cos(angle))).normalized()
            q_fore = (rest_wrist-rest_elbow).rotation_difference(fore_direction)
            hand = elbow+q_fore@(rest_wrist-rest_elbow)
            for name in [f"upperarm01.{side}", f"upperarm02.{side}"]:
                bone = bones[name]
                overrides[name] = world_transform(bone, q_upper, shoulder+q_upper@(bone.head_local-shoulder))
            for name in [f"lowerarm01.{side}", f"lowerarm02.{side}"]:
                bone = bones[name]
                overrides[name] = world_transform(bone, q_fore, elbow+q_fore@(bone.head_local-rest_elbow))
            # 手掌宽度与哑铃轴一致；手掌法线随前臂抬起平稳旋转。
            first = bones[f"finger2-1.{side}"].head_local
            last = bones[f"finger5-1.{side}"].head_local
            longitudinal = (bones[f"finger3-1.{side}"].head_local-rest_wrist).normalized()
            across = (last-first).normalized()*sign
            across = (across-longitudinal*across.dot(longitudinal)).normalized()
            normal = across.cross(longitudinal).normalized()
            rest_basis = Matrix((across, longitudinal, normal)).transposed()
            target_across = (V((1, 0, 0))-fore_direction*fore_direction.x).normalized()
            target_normal = target_across.cross(fore_direction).normalized()
            target_basis = Matrix((target_across, fore_direction, target_normal)).transposed()
            q_hand = (target_basis @ rest_basis.transposed()).to_quaternion()
            overrides[wrist.name] = world_transform(wrist, q_hand, hand)
            grip = hand+fore_direction*.078-target_normal*.013
            tools[side].location = grip
            # 哑铃轴保持水平；位置随握持点运动。
            # 指骨逐节弯曲，保留掌指关节和指节轮廓。
            for finger in range(2, 6):
                accumulated = q_hand.copy()
                chain = [bones[f"finger{finger}-{segment}.{side}"] for segment in range(1, 4)]
                points = [hand+q_hand@(chain[0].head_local-rest_wrist)]
                for segment in range(1, 4):
                    bone = chain[segment-1]
                    bend = [1.0, 1.25, .90][segment-1]
                    accumulated = Quaternion(target_across, -bend) @ accumulated
                    points.append(points[-1]+accumulated@(bone.tail_local-bone.head_local))
                along_bar = (points[0]-grip).dot(target_across)
                target = grip+target_across*along_bar-fore_direction*.012+target_normal*.020
                points = solve_chain(points, target)
                for j, bone in enumerate(chain):
                    original = q_hand@(bone.tail_local-bone.head_local)
                    rotation = original.rotation_difference(points[j+1]-points[j]) @ q_hand
                    overrides[bone.name] = world_transform(bone, rotation, points[j])
            thumb = [bones[f"finger1-{j}.{side}"] for j in range(1, 4)]
            points = [hand+q_hand@(bone.head_local-rest_wrist) for bone in thumb]
            points.append(hand+q_hand@(thumb[-1].tail_local-rest_wrist))
            target = grip+target_normal*.012-target_across*sign*.014
            points = solve_chain(points, target)
            for j, bone in enumerate(thumb):
                original = q_hand@(bone.tail_local-bone.head_local)
                rotation = original.rotation_difference(points[j+1]-points[j]) @ q_hand
                overrides[bone.name] = world_transform(bone, rotation, points[j])
            joint_record[side] = {"shoulder": list(shoulder), "elbow": list(elbow), "wrist": list(hand), "grip": list(grip)}
        absolute = {}
        for bone in ordered:
            parent = bone.parent
            if bone.name in overrides:
                matrix = overrides[bone.name]
            elif parent:
                matrix = absolute[parent.name] @ parent.matrix_local.inverted() @ bone.matrix_local
            else:
                matrix = bone.matrix_local.copy()
            absolute[bone.name] = matrix
            pb = rig.pose.bones[bone.name]
            kwargs = {"parent_matrix": absolute[parent.name], "parent_matrix_local": parent.matrix_local} if parent else {}
            pb.matrix_basis = bone.convert_local_to_pose(matrix, bone.matrix_local, invert=True, **kwargs)
            pb.rotation_mode = "QUATERNION"
            for data_path in ["location", "rotation_quaternion", "scale"]:
                pb.keyframe_insert(data_path=data_path, frame=i+1)
        emphasis = .25+.73*max(0, math.sin(phase*2*math.pi))
        contraction.value = u
        contraction.keyframe_insert("value", frame=i+1)
        color = V((.055, .001, .005)).lerp(V((.66, .004, .015)), emphasis)
        red.outputs[0].default_value = (*color, 1)
        red.outputs[0].keyframe_insert("default_value", frame=i+1)
        for obj in tools.values():
            obj.keyframe_insert("location", frame=i+1)
        telemetry.append({"frame": i+1, "joints": joint_record, "emphasis": emphasis})
    return telemetry


def setup_scene(samples):
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.eevee.taa_render_samples = samples
    scene.render.resolution_x, scene.render.resolution_y = 768, 896
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGB"
    scene.render.fps = FPS
    scene.frame_start, scene.frame_end = 1, FRAMES
    scene.world.use_nodes = True
    scene.world.node_tree.nodes["Background"].inputs["Color"].default_value = (.70, .75, .76, 1)
    scene.world.node_tree.nodes["Background"].inputs["Strength"].default_value = .26
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.look = "AgX - Medium High Contrast"
    floor = studio.material("Studio / cool off-white", (.72, .76, .75), .9)
    bpy.ops.mesh.primitive_plane_add(size=200, location=(0, 0, -.006))
    studio.finish(bpy.context.object, "Studio floor", floor)
    for name, location, energy, size in [
        ("Large key", (2, -3.5, 4.2), 380, 3.5),
        ("Soft fill", (-3, -1, 2.4), 160, 3.0),
        ("Edge light", (1, 2.0, 3.5), 360, 2.5),
    ]:
        data = bpy.data.lights.new(name, "AREA")
        data.energy, data.shape, data.size = energy, "DISK", size
        obj = bpy.data.objects.new(name, data)
        bpy.context.collection.objects.link(obj)
        obj.location = location
        obj.rotation_euler = (V((0, 0, 1))-obj.location).to_track_quat("-Z", "Y").to_euler()
    data = bpy.data.cameras.new("Review camera")
    camera = bpy.data.objects.new("Review camera", data)
    bpy.context.collection.objects.link(camera)
    camera.location = (2.7, -6.8, 2.6)
    camera.rotation_euler = (V((0, -.03, .94))-camera.location).to_track_quat("-Z", "Y").to_euler()
    data.type, data.ortho_scale = "ORTHO", 2.08
    scene.camera = camera
    return scene


def render_detail(scene):
    # 独立镜头真实渲染近景，避免裁切后放大造成模糊。
    scene.frame_set(19)
    camera = scene.camera
    camera.location = (2.7, -6.8, 2.8)
    camera.rotation_euler = (V((0, -.065, 1.29))-camera.location).to_track_quat("-Z", "Y").to_euler()
    camera.data.ortho_scale = .98
    scene.render.resolution_x, scene.render.resolution_y = 1024, 896
    scene.eevee.taa_render_samples = 128
    scene.render.filepath = str(ROOT / "surface-detail.png")
    bpy.ops.render.render(write_still=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--preview", action="store_true")
    parser.add_argument("--detail-only", action="store_true")
    parser.add_argument("--samples", type=int, default=96)
    args = parser.parse_args(sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else [])
    scene = setup_scene(args.samples)
    data = load_asset()
    body, rig = create_body_rig(*data)
    region_attributes(body, rig)
    material, red = surface_material()
    body.data.materials.append(material)
    add_shorts(body)
    tools = setup_weights()
    telemetry = animate(rig, tools, red, contraction_key(body))
    folder = ROOT / "renders"
    folder.mkdir(exist_ok=True)
    (folder / "motion.json").write_text(json.dumps(telemetry), encoding="utf-8")
    scene.frame_set(1)
    scene["Asset source"] = "MakeHuman core mesh / targets / rig / weights under CC0; see source/manifest.json"
    scene["Creative work"] = "Custom curl animation, surface muscle partitions, procedural material, camera and lighting"
    scene["Status"] = "Review sample, pending user approval; not integrated into App"
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / "refined-curl.blend"), compress=True)
    for i in ([] if args.detail_only else [0, 18, 36, 54] if args.preview else range(FRAMES)):
        scene.frame_set(i+1)
        scene.render.filepath = str(folder / f"{i:03d}.png")
        bpy.ops.render.render(write_still=True)
    render_detail(scene)
    print("DONE refined curl", flush=True)


if __name__ == "__main__":
    main()
