import sys, pathlib
d = pathlib.Path(__file__).parent
style_src = ((d / 'part_head.js').read_text().replace('one day\'s mail run', 'one day, fetch to apply') + (d / 'part_content.js').read_text() + (d / 'part_kit.js').read_text() + (d / 'part_story.js').read_text())
(d / 'style.js').write_text(style_src)
# the app copy: an ES module that runs the style block (globals THREE, K and registerStyle are set up first)
app = d.parent / 'web' / 'diorama'
app.mkdir(exist_ok=True)
(app / 'stage.js').write_text((d / 'stage.js').read_text())
(app / 'scene.js').write_text('// Built from ui/diorama-wip by build.py. Do not edit here.\n' + style_src + '\nexport {};\n')
t = (d / 'storyboard.template.html').read_text()
t = t.replace('/*__STAGE__*/', (d / 'stage.js').read_text()).replace('/*__STYLE__*/', (d / 'style.js').read_text())
(d / 'storyboard.html').write_text(t)
# a full-document copy for local testing (the artifact host adds the doctype/head wrapper)
(d / 'test.html').write_text('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>' + t + '</body></html>')
print('ok', len(t))
