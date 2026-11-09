(function () {
  var stored;
  try { stored = localStorage.getItem("jjh-theme"); } catch (error) {}
  var theme = stored === "light" || stored === "dark" ? stored :
    (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  document.documentElement.dataset.theme = theme;
  var banner = document.createElement("div");
  banner.className = "integration-banner";
  banner.innerHTML = '<div><strong>工匠的学习空间</strong><span> · 本机联调</span></div><div class="integration-tools"><a href="/agent.html">返回作品集</a><button type="button" aria-label="切换主题">切换主题</button></div>';
  document.querySelector("main").prepend(banner);
  banner.querySelector("button").addEventListener("click", function () {
    theme = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem("jjh-theme", theme); } catch (error) {}
  });
})();
