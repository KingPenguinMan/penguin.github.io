function triggerEncryptSubmit(event) {
  if (!event.target || event.target.id !== "btn-decrypt") {
    return;
  }

  const input = document.querySelector("#encrypt-blog input");
  if (!input) {
    return;
  }

  input.dispatchEvent(
    new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      key: "Enter",
      keyCode: 13
    })
  );
}

function buildHomeHero() {
  const bannerText = document.querySelector("#banner .banner-text");
  if (!bannerText || bannerText.querySelector(".home-hero-shell")) {
    return;
  }

  const shell = document.createElement("section");
  shell.className = "home-hero-shell";
  shell.innerHTML = `
    <div class="home-hero-kicker">Field Notes</div>
    <p class="home-hero-summary">
      这里记录技术、阅读、情绪波动和成长实验。不等完美，再开始表达。
    </p>
    <div class="home-hero-actions">
      <a class="site-button site-button--primary" href="/archives/">查看全部文章</a>
      <a class="site-button site-button--ghost" href="/about/">认识一下我</a>
    </div>
    <ul class="home-hero-meta">
      <li>主题：技术 / 杂谈 / 笔记</li>
      <li>节奏：长期更新的个人博客</li>
      <li>目标：写清楚，而不是写圆满</li>
    </ul>
  `;

  bannerText.appendChild(shell);
}

function buildHomeSectionLead() {
  const cards = Array.from(document.querySelectorAll(".index-card"));
  if (!cards.length) {
    return;
  }

  const firstCard = cards[0];
  const parent = firstCard.parentElement;
  if (!parent || parent.querySelector(".home-section-lead")) {
    return;
  }

  const intro = document.createElement("section");
  intro.className = "home-section-lead";
  intro.innerHTML = `
    <span class="home-section-kicker">Latest Writing</span>
    <h2 class="home-section-title">最近写下来的内容</h2>
    <p class="home-section-copy">
      文章不按“完整度”排序，而按当下最值得留下来的念头展开。这里会保留思考过程，也保留未完成感。
    </p>
  `;

  const grid = document.createElement("div");
  grid.className = "home-post-grid";

  cards.forEach((card) => {
    grid.appendChild(card);
  });

  parent.insertBefore(intro, firstCard);
  parent.insertBefore(grid, intro.nextSibling);
}

function enhanceHomePage() {
  if (!document.querySelector(".index-card")) {
    return;
  }

  buildHomeHero();
  buildHomeSectionLead();
}

document.addEventListener("DOMContentLoaded", () => {
  document.addEventListener("click", triggerEncryptSubmit);
  enhanceHomePage();
});
