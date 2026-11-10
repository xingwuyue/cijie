# 词库说明

本目录的 `index.json`、`ex1.json`–`ex5.json`、`manifest.json` 由 `scripts/build_lexicon.py` 生成，供词阶离线使用。组合后的词库以 CC BY-SA 4.0 授权，因为其中的词频数据要求以相同方式共享。

## 来源

- **词频与词条顺序**：wordfreq（Robyn Speer），代码 Apache-2.0，词频数据 CC BY-SA 4.0。数据综合了 Wikipedia、OpenSubtitles、ParaCrawl、Leeds Internet Corpus、Google Books Ngrams，以及 Marc Brysbaert 等人的 SUBTLEX 词表（作者同意可随 wordfreq 再分发）。致谢请写 Robyn Speer，并保留 SUBTLEX 与 Google Books Ngram Viewer 的出处。
- **中文释义与词形变化**：ECDICT（Linwei，MIT）。只用了中文释义和屈折变化，用来合并 ran/run 这类形式、并生成简短中文义项。没有使用其中的牛津、柯林斯标签，也没有使用其音标字段。ECDICT 作者说明基础来自开源词典 cdict 与社区修订。
- **音标**：open-dict-data/ipa-dict 的美国英语表，基于 CMU Pronouncing Dictionary（卡内基梅隆大学，BSD 风格许可）及 cmudict-ipa（MIT）。为了手机上更好认，把美音里的 ɹ、ɫ 显示成 r、l。
- **例句**：Tatoeba 项目的英语–普通话对照句（CC BY 2.0 FR），经 OPUS / Tatoeba 导出文件对齐。界面里这些句子标为 Tatoeba。缺句或原句不合适时，用词阶编写的短句补上，标为原创。
- **未收入**：牛津、韦氏、柯林斯、有道、金山等专有词典的正文；也没有抓取商业网站。

## 词条怎么筛

wordfreq 的顺序先把屈折形式并回词元（found → find），再去掉冠词、代词、be/do/have、最常见的连词介词和单纯功能词，然后按频率重排。所以第一阶是最常用的 1000 个实词，不是 the / of / and。人名条目（男子名、女子名、姓氏）已跳过。

## 链接

- wordfreq：https://github.com/rspeer/wordfreq
- CC BY-SA 4.0：https://creativecommons.org/licenses/by-sa/4.0/
- ECDICT：https://github.com/skywind3000/ECDICT
- CMUdict：https://github.com/cmusphinx/cmudict
- ipa-dict：https://github.com/open-dict-data/ipa-dict
- Tatoeba：https://tatoeba.org  ·  https://creativecommons.org/licenses/by/2.0/fr/
- Google Books Ngram Viewer：https://books.google.com/ngrams
- SUBTLEX：https://www.ugent.be/pp/experimentele-psychologie/en/research/documents/subtlexus
