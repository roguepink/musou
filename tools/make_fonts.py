#!/usr/bin/env python3
"""ゲームで使う字だけを、筆文字(Yuji Boku)と太字(Dela Gothic One)から取り出して fonts/ に作る。
文字を足したら もう一度動かす(使っていない字は 四角や別の字の形で出てしまうため)。
  python3 tools/make_fonts.py <元のフォントのフォルダ>
元のフォント: https://github.com/google/fonts の ofl/yujiboku と ofl/delagothicone(どちらも SIL Open Font License)
"""
import sys, pathlib
from fontTools import subset
here = pathlib.Path(__file__).resolve().parent.parent
src = pathlib.Path(sys.argv[1])
text = ''.join((here / f).read_text(encoding='utf8') for f in ('game.js', 'index.html'))
chars = set(c for c in text if ord(c) > 127) | set(chr(i) for i in range(32, 127)) | set('一二三四五六七八九十百千万第陣')
# 筆文字は重いので、見出しに使う字だけ(題名・第◯陣・大将の名前・見出し)
brush = ('侍無双第陣一二三四五六七八九十百千万 大将見参激怒り目の前に急いで倒せ討ち取ったり敵大軍来襲騎馬隊突撃弓出現丸太が来る'
         '人斬勢赤鬼がしゃどくろ土蜘蛛八岐蛇武者龍神死破出挑む夕暮れ桜街道霧竹林月夜城下町吹雪峠炎上する合戦場黄泉ひと休み!・〜 ')
for name, out, cs in (('YujiBoku-Regular.ttf', 'yuji.woff', set(brush)), ('DelaGothicOne-Regular.ttf', 'dela.woff', chars)):
    chars_use = cs
    opt = subset.Options(); opt.flavor = 'woff'; opt.layout_features = ['*']; opt.name_IDs = ['*']; opt.notdef_outline = True
    f = subset.load_font(str(src / name), opt)
    s = subset.Subsetter(opt); s.populate(text=''.join(chars_use)); s.subset(f)
    subset.save_font(f, str(here / 'fonts' / out), opt)
    print(out, (here / 'fonts' / out).stat().st_size // 1024, 'KB')
