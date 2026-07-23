<template>
  <div class="about">
    <h1 class="page-title">关于</h1>

    <div class="card block" v-reveal>
      <h2>这个网站</h2>
      <p>
        一个用照片和日记记录生活的个人小站。照片流按时间排列,日记按篇归档,
        所有内容都由本地文件驱动 —— 新增一篇日记,只需要往
        <code>content/diary/</code> 里放一个 Markdown 文件。
      </p>
    </div>

    <div class="card block" v-reveal>
      <h2>关于我</h2>
      <p>
        这里写一段自我介绍:你是谁,为什么拍照,为什么写字。
        比如:一个喜欢早起追光、雨天逛旧书店的人。
      </p>
    </div>

    <div class="card block" v-reveal>
      <h2>联系</h2>
      <p>
        想打个招呼?可以在 GitHub 上找到这个网站的仓库,或者把这里替换成你的邮箱与社交账号。
      </p>
    </div>
  </div>
</template>

<style scoped>
.about { max-width: 720px; margin: 0 auto; }

.page-title { font-size: 2rem; margin: 0 0 1.8rem; }

.block { padding: 1.6rem 1.8rem; margin-bottom: 1.3rem; }

.block h2 { margin: 0 0 0.7rem; font-size: 1.15rem; color: var(--accent); }

.block p { margin: 0; line-height: 1.9; color: var(--text-soft); }

.block code {
  background: var(--accent-soft);
  padding: 0.15em 0.45em;
  border-radius: 6px;
  font-size: 0.88em;
}
</style>
