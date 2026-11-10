# 词阶

给中文使用者的英语词汇应用。按日常使用频率分成五阶，每个词都放在句子里学。界面是简体中文，学习日按北京时间（Asia/Shanghai）切换。

第一版没有账号，也没有服务器。进度保存在这台设备上，用 Safari 打开就能学，也可以在 Expo Go 里打开。上架 App Store 需要 Apple 开发者账号，不在这一版里。

## 现在就能用

```bash
npm install
```

### 网页

```bash
npx expo start --web
```

或固定端口：

```bash
npm run web
```

然后用浏览器打开终端里给出的地址。手机和电脑在同一个 Wi-Fi 时，也可以用终端里的局域网地址，在 iPhone 的 Safari 中打开。

### 静态网页（以后部署用）

```bash
npx expo export --platform web
```

产物在 `dist/`。把这个目录交给任意静态网站托管即可。页面在构建时已经生成，不需要单独的 Node 服务。直接打开 `dist/index.html` 不行，需要通过网站根路径提供，这样 `/manifest.json` 和脚本路径才正确。

### iPhone：添加到主屏幕

1. 用 **Safari** 打开上面的网页（不要用微信内置浏览器）。
2. 点底部的分享按钮。
3. 选择 **添加到主屏幕**。
4. 名称会显示为「词阶」。之后从主屏幕打开，是独立窗口，没有 Safari 的地址栏。

第一次用 iPhone Safari 打开时，首页也会提示这一步。不需要 Mac，也不需要 Apple 开发者账号。

### Expo Go

1. 在 iPhone 上安装 [Expo Go](https://expo.dev/go)。
2. 电脑上运行 `npx expo start`。
3. 手机和电脑连同一个 Wi-Fi，用 Expo Go 扫描终端里的二维码。

进度存在本机。网页和 Expo Go 的存储是分开的，不会自动同步。

## 每天怎么学

- 默认每天 **15** 个新词，可在设置里改成 10 或 20。
- 第二天会先复习昨天新学的全部词。
- 然后再带少量更早、已经到期的词。间隔按认识与否拉开：1 天、3 天、7 天、14 天、30 天、60 天。模糊会缩短，不认识则明天再来。昨天的词始终排在这些旧词前面。
- 每个词都有英文、音标、词性、简短中文，以及带译文的例句。例句里的目标词会标出来。
- 新词先讲，再做一次句意确认，然后自评：认识 / 模糊 / 不认识。复习则先看句子，再翻开释义。
- 点「听」可以朗读。用的是系统语音，不需要 API 密钥。iPhone 如果开了静音开关，可能没有声音。

## 五阶和解锁

词条来自 wordfreq 的英语词频。屈折形式会并回词元（例如 found 并回 find），并且去掉了 the、of、I、be 这类纯功能词，再按频率重排。所以第一阶是最常用的 1000 个实词，不是冠词表。

| 阶 | 范围 |
| --- | --- |
| 第一阶 | 1–1000 |
| 第二阶 | 1001–3000 |
| 第三阶 | 3001–5000 |
| 第四阶 | 5001–10000 |
| 第五阶 | 10001–20000 |

解锁下一阶的条件，首页写得很明确：

- 当前阶已学满 **80%**
- 近 **7** 天的复习里，至少 **20** 次评分，其中 **75%** 选了「认识」

两个条件都满足后，**从第二天**才开始主要取下一阶的新词，当天不会突然换一批。上一阶还没学完的词，之后每天最多再带 3 个。正确率只统计复习（昨日复习和间隔复习），不算第一次见到新词时的自评。

前 5000 词都有音标、词性、中文和至少一句例句。5001 以后如果缺例句，学习页会说明，不会因此崩溃。

## 词库许可

组合后的词库（`src/data/*.json`）以 **CC BY-SA 4.0** 提供，因为词频数据要求相同方式共享。细节和致谢在 [`src/data/NOTICE.md`](src/data/NOTICE.md)。

- 词频：[wordfreq](https://github.com/rspeer/wordfreq)，Robyn Speer。代码 Apache-2.0，数据 CC BY-SA 4.0。综合了 Wikipedia、OpenSubtitles、ParaCrawl、Leeds Internet Corpus、Google Books Ngrams，以及 Marc Brysbaert 等人的 SUBTLEX 词表。
- 中文释义和词形变化：[ECDICT](https://github.com/skywind3000/ECDICT)（MIT）。没有使用其中的牛津 / 柯林斯标签，也没有使用其音标字段。
- 音标：[CMU Pronouncing Dictionary](https://github.com/cmusphinx/cmudict) 经由 [ipa-dict](https://github.com/open-dict-data/ipa-dict) 的美国英语表（BSD 风格许可与 MIT）。
- 例句：[Tatoeba](https://tatoeba.org) 英语–普通话对照（[CC BY 2.0 FR](https://creativecommons.org/licenses/by/2.0/fr/)）。界面里这些句子标为 Tatoeba。缺句用词阶原创短句补上。

没有复制牛津、韦氏、柯林斯、有道、金山等专有词典，也没有抓取商业网站。

重新生成词库（可选，应用不依赖这一步，生成结果已经提交）：

```bash
python3 -m venv .venv
.venv/bin/pip install wordfreq zhconv
# 还需要把 ECDICT、ipa-dict 和 Tatoeba 导出文件放在脚本期望的位置，见 scripts/build_lexicon.py
.venv/bin/python scripts/build_lexicon.py
```

## 以后如果要上架 App Store

这一版没有配置签名、TestFlight 或 EAS。代码是普通的 Expo 工程，以后可以加，不必重写界面。

上架需要：

1. 一个 [Apple Developer Program](https://developer.apple.com/programs/) 账号（年费，由苹果收取）。
2. 用 [EAS](https://docs.expo.dev/eas/) 做 iOS 构建和提交，例如 `eas build --platform ios` 和 `eas submit`。证书和描述文件由 EAS 向苹果申请，不能在没有开发者账号的情况下完成。
3. 本仓库没有 `eas.json`。准备上架时再添加即可。

在那之前，Safari「添加到主屏幕」和 Expo Go 就是可用的安装方式。

## 脚本

| 命令 | 作用 |
| --- | --- |
| `npm test` | 学习日、复习间隔、解锁条件的单元测试 |
| `npm run typecheck` | TypeScript 检查 |
| `npm run export:web` | 导出 `dist/` |
