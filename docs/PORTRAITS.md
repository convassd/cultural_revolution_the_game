# Character portraits

Each character has an independent illustration file. All 48 current cards use locally authored SVG artwork. Replacing one file changes only that character.

## Replace a portrait

- For SVG, overwrite the corresponding file under `public/portraits/`.
- For PNG, JPG or WebP, place the image there and update that character's `image` in `src/data/characters.json`, for example `/portraits/mao_zedong.png`.
- Store the image path without the `public/` prefix. The component combines it with the deployment base path.
- `placeholder.svg` is retained as the original fallback; no current character references it.

## Illustration approach

The images use a 600 × 360 (5:3) composition with warm side light, cool shadows, simplified scenery and props, and light grain. They consist of SVG paths, gradients and built-in filters, without embedded photographs, external resources or fonts.

This is simplified vector illustration, rather than production-quality painted card art. Cap emblems, shoulder details and medals are decorative approximations, not reconstructions of historical uniforms. Backgrounds, props and lighting are game compositions, not reconstructions of documented scenes.

Historical photographs and paintings were consulted for likeness and pose; the downloaded reference images are not included in the repository or build. The [Hearthstone art direction article](https://hearthstone.blizzard.com/en-gb/news/13023802) informed small-size readability, character focus and scene composition. No Blizzard images, frames, fonts or other assets are bundled.

## First 24 portraits: references and composition

- **Chen Boda — Ink and Paper** (`chen_boda`): Cloth cap, round glasses, a lean three-quarter profile, book pages and a pen. [Reference 1](https://www.sohu.com/a/624102616_121628654) · [Reference 2](https://p7.itc.cn/images01/20230103/5b69495c61fe42349511864f44c067c1.jpeg)
- **Chen Xilian — At the Front** (`chen_xilian`): Narrow eyes and a broad jaw, uniform, map and artillery silhouettes. [Reference 1](https://commons.wikimedia.org/wiki/File:Chenxillian.jpg)
- **Chen Yi — Changing Skies** (`chen_yi`): Broad forehead, full cheeks and bright eyes, formal uniform, clouds and a scroll. [Reference 1](https://commons.wikimedia.org/wiki/File:Chen_Yi(communist).jpg)
- **Chen Yun — Accounts and Balance** (`chen_yun`): Side-parted short hair, broad forehead and full cheeks, blue-grey tunic, ledger and abacus. [Reference 1](https://commons.wikimedia.org/wiki/File:陈云标准像.jpg)
- **Chen Zaidao — Riverbank Front** (`chen_zaidao`): Longer face, broad nose and a toothy smile, river bridge and binoculars. [Reference 1](https://commons.wikimedia.org/wiki/File:1955chenzaidao.jpg)
- **Deng Xiaoping — Return** (`deng_xiaoping`): Redrawn with a short broad face, full jaw, receding grey hair, heavy eyelids and visible eye bags. Three looping light bands echo his return mechanic; workshop gears occupy the foreground. [Reference 1](https://les-yeux-du-monde.fr/ressources/19466-deng-biographie)
- **Guan Feng — The Pen's Edge** (`guan_feng`): Based on an available later-life portrait: sparse grey hair, high forehead and an upward gaze, brush, manuscript and ink. A misidentified side-profile photograph of Chen Boda was excluded. [Reference 1](https://m1.aboluowang.com/uploadfile/2026/0217/thumb_400_400_20260217205437438.jpg)
- **He Long — Mountains and Rivers** (`he_long`): Heavy brows, moustache and slightly tilted cap, mountains and a wooden pipe. [Reference 1](https://commons.wikimedia.org/wiki/File:He_Long.jpg)
- **Hua Guofeng — Barrier** (`hua_guofeng`): Neatly swept-back hair, thick brows and full cheeks, doorway and pale-blue shield patterns echoing Protection. [Reference 1](https://news.ifeng.com/history/1/renwu/200801/0128_2665_379949_6.shtml)
- **Huang Yongsheng — Command Lines** (`huang_yongsheng`): Square jaw, thick brows and a serious expression, forest, communication lines and field telephone. [Reference 1](https://commons.wikimedia.org/wiki/File:Huang_Yongsheng.jpg)
- **Ji Dengkui — At the Desk** (`ji_dengkui`): Broad forehead, short hair and rounded rectangular glasses, files and a pen. [Reference 1](https://inf.news/en/history/3af06aa18b1cb52a75a3558e4a13a6be.html)
- **Jiang Qing — On Stage** (`jiang_qing`): Based on a speech photograph with cap and glasses: short hair, raised head, curtain and vintage microphone. [Reference 1](https://commons.wikimedia.org/wiki/File:1967-07_1967年4月20日北京市革命委员会成立_江青.jpg)
- **Kang Sheng — Ink Shadows** (`kang_sheng`): Long narrow face, round glasses and thin moustache, brush, ink and manuscripts. [Reference 1](https://commons.wikimedia.org/wiki/File:Kang_Sheng.jpg)
- **Kuai Dafu — Paper Storm** (`kuai_dafu`): Rounded rectangular glasses and short hair, green jacket, papers and megaphone. The available photograph was from a later period; age and clothing were adapted for the illustration. [Reference 1](https://www.sohu.com/a/900104315_121165470)
- **Li Fuchun — Industry and Planning** (`li_fuchun`): Sparse grey hair, high forehead and grey-white beard, factory silhouette, planning diagram and gears. [Reference 1](https://www.sohu.com/a/588420646_247380)
- **Li Xiannian — Among the Files** (`li_xiannian`): Broad forehead, receding grey hair and full cheeks, case files and account pages. [Reference 1](https://www.sohu.com/a/923625987_122481590)
- **Li Zuopeng — Sea Routes** (`li_zuopeng`): Dark glasses, peaked cap and simplified naval uniform decorations, ship silhouette and wheel. [Reference 1](https://www.xinzheng100.com/xuexiyuandishow-84-4146-1.html)
- **Lin Biao — Shattered Halberd** (`lin_biao`): Long narrow face, military cap and thin lips, mountains and a broken hourglass echoing the countdown ability. [Reference 1](https://info.51.ca/articles/444820)
- **Lin Liguo — Flight Path** (`lin_liguo`): Thick brows, rounder eyes and youthful face, aviation chart and flight trails. The reference identifies him as the person on the left with Lin Doudou on 6 October 1967; misleading search matches and unavailable images were excluded. [Reference 1](https://blog.sina.com.cn/s/blog_4447da480102z3gq.html)
- **Liu Shaoqi — Defense** (`liu_shaoqi`): Grey-white side-parted hair, broad forehead and square jaw, documents and an enamel cup. [Reference 1](https://ses.xisu.edu.cn/info/1478/11991.htm)
- **Luo Ruiqing — At the Front** (`luo_ruiqing`): Tilted cap, long face and a toothy smile, uniform, forest and binoculars. [Reference 1](https://inf.news/en/military/87078859abc2598fa807a6b3c03afb45.html)
- **Mao Yuanxin — Communication Lines** (`mao_yuanxin`): Youthful short hair, thick brows, broad nose and square jaw, radio and documents. A solo portrait was cross-checked against a captioned historical group photograph. [Reference 1](https://x.com/CarlZha/status/1396003907793416196) · [Reference 2](https://hb.ifeng.com/news/cjgc/detail_2013_05/10/788636_0.shtml)
- **Mao Zedong — Command amid Clouds** (`mao_zedong`): Redrawn from painted representations: high forehead, receding hairline, swept-back side hair, narrow eyes and eye bags, broad nostrils, closed lips, rounded jaw and the mole below the lower lip. The blue-grey tunic, landscape, light patterns and scroll were retained. References include Jin Shangyi's Full-Length Portrait of Chairman Mao at the Beijing Taikang Art Museum and a painted Tiananmen portrait. [Reference 1](https://taikangartmuseum.com/zh/tai-kang-collection/full-length-portrait-of-chairman-mao/) · [Reference 2](https://www.hk01.com/即時中國/367026/天安門毛澤東畫像畫師王國棟去世-油畫版本自1967年沿用至今)
- **Nie Yuanzi — Writing on the Wall** (`nie_yuanzi`): Cap, short hair, full cheeks and fine brows, wall posters and a brush. [Reference 1](https://club.6parkbbs.com/chan1/index.php?act=threadview&app=forum&tid=14645144)

## Remaining 24 portraits: poses from reference photographs

This batch takes body orientation, gaze, seated/standing posture, arm movement and necessary props from captioned photographs, then redraws them as vector illustrations. The source photos are not embedded. Background, lighting and framing remain adaptations for cards.

Among these selected references, 12 of 24 (50%) have explicit actions, eight have static poses and four are portraits. Actions count waving, handshaking, reading papers, chopping vegetables, arranging papers, clapping, linking arms, carrying flowers, touching the forehead, writing and saluting. Standing with hands in pockets, leaning, sitting or turning the face are not counted as actions. These proportions describe the selected references, not all surviving photographs of these people.

Zhang Yufeng replaced Wang Naiying because no reliable likeness reference was found for the latter. Her card keeps R rarity, Unaffiliated faction, cost 2, attack 2, health 3, no ability and no relationship group. Her captioned train-side group photograph informed the braids, standing posture and lowered arms.

Peng Zhen, Qi Benyu, Wang Li and Wu Faxian use later-life photographs and retain the referenced age and pose. Xie Fuzhi is the central desk-leaning figure in his reference, rather than an adjacent person clapping. Wang Dongxing uses an explicitly captioned standing photograph from 1963; an uncertain identification holding documents was excluded.

Head, neck and collar alignment was subsequently corrected for Zhou Enlai, Yao Wenyuan, Wu Han, Yang Shangkun, Xu Xiangqian, Tan Zhenlin and Qiu Huizuo while preserving their poses. Mao Zedong was separately redrawn from painted references after the first portrait batches.

| No. | Character / asset | Referenced pose | Category | Sources |
| --- | --- | --- | --- | --- |
| 25 | [Peng Dehuai](../public/portraits/peng_dehuai.svg) | Head lowered, hands in pockets | Static pose | [Page](https://wenhui.whb.cn/third/baidu/202103/16/396022.html) · [Image](https://wenhui.whb.cn/u/cms/www/202103/151403317pz9.jpg) |
| 26 | [Peng Zhen](../public/portraits/peng_zhen.svg) | Leaning against a chair, laughing | Static pose | [Page](https://gobackhistory.blogspot.com/2014/06/blog-post_23.html) · [Image](https://1.bp.blogspot.com/-4V8LecdJOoc/Uy1PvhH_CUI/AAAAAAAACvk/JAiH9ToZSWc/s512/50bbf7f612193d5f78f8d0a75954d723%255B1%255D.jpg) |
| 27 | [Qi Benyu](../public/portraits/qi_benyu.svg) | Upward-looking close-up | Portrait / gaze | [Page](https://www.aboluowang.com/2016/0510/736453.html) · [Image](https://m1.aboluowang.com/uploadfile/2016/0510/20160510100824750.webp) |
| 28 | [Qiu Huizuo](../public/portraits/qiu_huizuo.svg) | Holding and reading papers | Action | [Page](https://info.51.ca/articles/439676) · [Image](https://p0.51img.ca/i/625f9856144f9.jpeg) |
| 29 | [Tan Zhenlin](../public/portraits/tan_zhenlin.svg) | Talking in profile | Portrait / gaze | [Page](https://www.fjydnews.com/2021-09/03/content_1149091.htm) · [Image](https://www.fjydnews.com/images/2021-09/03/a57cf428-8256-4b52-9cda-fae02050bd31.jpg) |
| 30 | [Tao Zhu](../public/portraits/tao_zhu.svg) | Reaching for a handshake | Action | [Page](https://gjkeji.com/thread-18030-1-1.html) · [Image](https://gjkeji.com/data/attachment/forum/202408/28/150145f7turjd11pnspruj.jpeg) |
| 31 | [Wang Dongxing](../public/portraits/wang_dongxing.svg) | Standing with arms lowered | Static pose | [Page](https://nankaioverseas.net/China/WangDongxingMaoZD082215.html) · [Image](https://nankaioverseas.net/China/People/WangdongxingMaoZd2.jpg) |
| 32 | [Wang Hongwen](../public/portraits/wang_hongwen.svg) | Raising a hand in greeting | Action | [Page](https://www.sohu.com/a/239435125_486479) · [Image](https://5b0988e595225.cdn.sohucs.com/q_70%2Cc_zoom%2Cw_640/images/20180705/ed19e4ada81449989fe34ed16b151cb4.jpeg) |
| 33 | [Wang Li](../public/portraits/wang_li.svg) | Standing with a walking stick | Static pose | [Page](https://www.sohu.com/a/655977980_120631063) · [Image](https://p3.itc.cn/q_70/images01/20230318/90a0018f4dd2454ab8039412220ae9c2.png) |
| 34 | [Wu De](../public/portraits/wu_de.svg) | Sideways-looking portrait | Portrait / gaze | [Page](https://baike.so.com/gallery/list?eid=5372559&ghid=first&pic_idx=1&sid=5608496) · [Image](https://so1.360tres.com/t0139842705a759a520.jpg) |
| 35 | [Wu Faxian](../public/portraits/wu_faxian.svg) | Cutting vegetables in a kitchen | Action | [Page](https://everydaylifeinmaoistchina.org/2015/04/06/wu-faxian-makes-a-meal-at-home/) · [Image](https://everydaylifeinmaoistchina.org/wp-content/uploads/2015/03/e6999ae5b9b4e79a84e590b4e6b395e5aeaae5ada6e4bc9ae4ba86e5819a5ad.jpg) |
| 36 | [Wu Han](../public/portraits/wu_han.svg) | Leaning over a desk, arranging papers | Action | [Page](https://www.sohu.com/a/407692255_120280139) · [Image](https://p6.itc.cn/images01/20200715/c5d39106ac384ea48698183c31fe21fa.jpeg) |
| 37 | [Xie Fuzhi](../public/portraits/xie_fuzhi.svg) | Leaning forward with hands on a desk | Static pose | [Page](https://www.posterazzi.com/high-level-chinese-government-officials-during-the-cultural-revolution-center-xie-fuzhi-history-item-varevccsub001cs867/) · [Image](https://cdn11.bigcommerce.com/s-yzgoj/images/stencil/1280x1280/products/1963203/4613707/apisr7eia__59720.1626425713.jpg?c=2) |
| 38 | [Xu Xiangqian](../public/portraits/xu_xiangqian.svg) | Looking upward in side light | Portrait / gaze | [Page](https://www.sohu.com/a/593301973_247380) · [Image](https://p6.itc.cn/q_70/images03/20221017/f99de0dc69be448484c12916952bf4ad.jpeg) |
| 39 | [Yang Chengwu](../public/portraits/yang_chengwu.svg) | Standing by a railing | Static pose | [Page](https://wudongfeng.blog.caixin.com/archives/190699) · [Image](https://pic.caixin.com/blog/Mon_1810/m_1539840596_mBiXcn.png) |
| 40 | [Yang Shangkun](../public/portraits/yang_shangkun.svg) | Seated, applauding | Action | [Page](https://kknews.cc/zh-hk/military/363evvg.html) · [Image](https://i2.kknews.cc/zw8EGQeGuxr4tQeZofsWlZ1AuiQdsnotIA/0.jpg) |
| 41 | [Yao Dengshan](../public/portraits/yao_dengshan.svg) | Linked arms in a group photograph | Action | [Page](https://www.wenxuecity.com/blog/201410/55817/20170.html) · [Image](https://lh4.googleusercontent.com/-94asDADlAL4/VESyH2jY8mI/AAAAAAAAEYw/vFyCRMABXZY/s640/IMG_3359s.jpg) |
| 42 | [Yao Wenyuan](../public/portraits/yao_wenyuan.svg) | Speaking while holding a manuscript | Action | [Page](https://6do.world/t/topic/32455) · [Image](https://6do.world/uploads/default/original/3X/c/3/c3d7d566eeef2d62f1965e8969874eb2847f1a84.png) |
| 43 | [Ye Jianying](../public/portraits/ye_jianying.svg) | Walking with flowers | Action | [Page](https://www.lifeweek.com.cn/h5/article/detail?artId=26346) · [Image](https://image.ku.lifeweek.com.cn/content/1/537/1515297529982737.jpg) |
| 44 | [Ye Qun](../public/portraits/ye_qun.svg) | Seated with hands folded in lap | Static pose | [Page](https://www.aboluowang.com/2024/1007/2111960.html) · [Image](https://m1.aboluowang.com/uploadfile/2024/1007/20241007094755963.webp) |
| 45 | [Zhang Chunqiao](../public/portraits/zhang_chunqiao.svg) | Smiling with a hand to his forehead | Action | [Page](https://www.bannedbook.org/bnews/lishi/20190330/1105426.html/amp) · [Image](https://p0.51img.ca/i/625efec955495.jpeg) |
| 46 | [Zhang Yufeng](../public/portraits/zhang_yufeng.svg) | Standing beside a train | Static pose | [Page](https://crt.com.cn/news2007/news/HStop/2020/9/20914183626BD0F39GBD46JKHCIJH2I.html) · [Image](https://www.crt.com.cn/2020images/9/hs740.jpg) |
| 47 | [Zhou Enlai](../public/portraits/zhou_enlai.svg) | Looking down while writing | Action | [Page](https://www.ishufa.cn/blog/?id=464) · [Image](https://www.ishufa.cn/blog/zb_users/upload/2022/03/20220313130614164714797478715.jpg) |
| 48 | [Zhu De](../public/portraits/zhu_de.svg) | Smiling and saluting | Action | [Page](https://soha.vn/cuoc-dau-to-nguyen-soai-tq-chu-duc-lenh-khan-24h-dac-biet-20161003163412077.htm) · [Image](https://interactive.mediacdn.vn/2016/c-1475483113853.png) |

## Asset index

| Character | Independent file |
| --- | --- |
| Mao Zedong | [mao_zedong.svg](../public/portraits/mao_zedong.svg) |
| Zhou Enlai | [zhou_enlai.svg](../public/portraits/zhou_enlai.svg) |
| Deng Xiaoping | [deng_xiaoping.svg](../public/portraits/deng_xiaoping.svg) |
| Lin Biao | [lin_biao.svg](../public/portraits/lin_biao.svg) |
| Jiang Qing | [jiang_qing.svg](../public/portraits/jiang_qing.svg) |
| Liu Shaoqi | [liu_shaoqi.svg](../public/portraits/liu_shaoqi.svg) |
| Zhang Chunqiao | [zhang_chunqiao.svg](../public/portraits/zhang_chunqiao.svg) |
| Chen Boda | [chen_boda.svg](../public/portraits/chen_boda.svg) |
| Kang Sheng | [kang_sheng.svg](../public/portraits/kang_sheng.svg) |
| Peng Zhen | [peng_zhen.svg](../public/portraits/peng_zhen.svg) |
| Wang Li | [wang_li.svg](../public/portraits/wang_li.svg) |
| Tao Zhu | [tao_zhu.svg](../public/portraits/tao_zhu.svg) |
| Wang Hongwen | [wang_hongwen.svg](../public/portraits/wang_hongwen.svg) |
| Yao Wenyuan | [yao_wenyuan.svg](../public/portraits/yao_wenyuan.svg) |
| Hua Guofeng | [hua_guofeng.svg](../public/portraits/hua_guofeng.svg) |
| Ye Jianying | [ye_jianying.svg](../public/portraits/ye_jianying.svg) |
| Wang Dongxing | [wang_dongxing.svg](../public/portraits/wang_dongxing.svg) |
| Chen Yi | [chen_yi.svg](../public/portraits/chen_yi.svg) |
| Xie Fuzhi | [xie_fuzhi.svg](../public/portraits/xie_fuzhi.svg) |
| Wu Han | [wu_han.svg](../public/portraits/wu_han.svg) |
| Ye Qun | [ye_qun.svg](../public/portraits/ye_qun.svg) |
| Chen Zaidao | [chen_zaidao.svg](../public/portraits/chen_zaidao.svg) |
| Guan Feng | [guan_feng.svg](../public/portraits/guan_feng.svg) |
| Li Xiannian | [li_xiannian.svg](../public/portraits/li_xiannian.svg) |
| Luo Ruiqing | [luo_ruiqing.svg](../public/portraits/luo_ruiqing.svg) |
| Mao Yuanxin | [mao_yuanxin.svg](../public/portraits/mao_yuanxin.svg) |
| Nie Yuanzi | [nie_yuanzi.svg](../public/portraits/nie_yuanzi.svg) |
| Wu De | [wu_de.svg](../public/portraits/wu_de.svg) |
| Qi Benyu | [qi_benyu.svg](../public/portraits/qi_benyu.svg) |
| Yang Chengwu | [yang_chengwu.svg](../public/portraits/yang_chengwu.svg) |
| Yang Shangkun | [yang_shangkun.svg](../public/portraits/yang_shangkun.svg) |
| Wu Faxian | [wu_faxian.svg](../public/portraits/wu_faxian.svg) |
| Zhu De | [zhu_de.svg](../public/portraits/zhu_de.svg) |
| Kuai Dafu | [kuai_dafu.svg](../public/portraits/kuai_dafu.svg) |
| Huang Yongsheng | [huang_yongsheng.svg](../public/portraits/huang_yongsheng.svg) |
| Li Fuchun | [li_fuchun.svg](../public/portraits/li_fuchun.svg) |
| Xu Xiangqian | [xu_xiangqian.svg](../public/portraits/xu_xiangqian.svg) |
| Tan Zhenlin | [tan_zhenlin.svg](../public/portraits/tan_zhenlin.svg) |
| Chen Xilian | [chen_xilian.svg](../public/portraits/chen_xilian.svg) |
| Zhang Yufeng | [zhang_yufeng.svg](../public/portraits/zhang_yufeng.svg) |
| He Long | [he_long.svg](../public/portraits/he_long.svg) |
| Lin Liguo | [lin_liguo.svg](../public/portraits/lin_liguo.svg) |
| Yao Dengshan | [yao_dengshan.svg](../public/portraits/yao_dengshan.svg) |
| Chen Yun | [chen_yun.svg](../public/portraits/chen_yun.svg) |
| Li Zuopeng | [li_zuopeng.svg](../public/portraits/li_zuopeng.svg) |
| Ji Dengkui | [ji_dengkui.svg](../public/portraits/ji_dengkui.svg) |
| Peng Dehuai | [peng_dehuai.svg](../public/portraits/peng_dehuai.svg) |
| Qiu Huizuo | [qiu_huizuo.svg](../public/portraits/qiu_huizuo.svg) |

Generated full-size renders, small-card comparisons, earlier versions and hash checks live in the local `artifacts/` directory. They are excluded from Git and are not linked as repository documents.
