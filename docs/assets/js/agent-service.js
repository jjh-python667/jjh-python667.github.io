(function () {
  var host = document.querySelector("[data-agent-service]");
  if (!host) return;
  var label = host.querySelector("[data-service-label]");
  var detail = host.querySelector("[data-service-detail]");
  var entry = host.querySelector("[data-workspace-link]");
  var retry = host.querySelector("[data-service-retry]");
  async function checkService() {
    retry.disabled = true;
    label.textContent = "正在检测学习服务…";
    try {
      var response = await fetch("/api/state", { credentials: "same-origin", signal: AbortSignal.timeout(5000), cache: "no-store" });
      if (!response.ok && response.status !== 401) throw new Error("service unavailable");
      host.dataset.connected = "true";
      entry.href = "/learning/";
      entry.textContent = response.status === 401 ? "登录学习工作台" : "打开学习工作台";
      if (response.status === 401) {
        label.textContent = "学习服务已连接";
        detail.textContent = "登录自己的账户，继续课程、资料和对话。";
      } else {
        var state = await response.json();
        label.textContent = state.configured ? "本机已连接 · 真实模型可用" : "本机已连接 · 模型待配置";
        detail.textContent = state.configured ? "可以上传资料、提问和继续学习。当前为本机联调，公网邀请试用仍在准备。" : "课程和资料管理已可使用，配置模型后即可生成真实回复。";
      }
    } catch (error) {
      host.dataset.connected = "false";
      label.textContent = "等待学习服务连接";
      detail.textContent = "可以先体验下方示例，并在开放进度里查看公网试用状态。";
      entry.href = "#trial-status";
      entry.textContent = "查看开放进度";
    } finally { retry.disabled = false; }
  }
  retry.addEventListener("click", checkService);
  document.querySelectorAll("[data-demo-step]").forEach(function (button) {
    button.addEventListener("click", function () {
      var target = document.querySelector('[data-flow-step="' + button.dataset.demoStep + '"]');
      if (target) { target.click(); target.focus({ preventScroll: true }); }
    });
  });
  if (document.querySelector('meta[name="deployment-mode"][content="static-portfolio"]')) {
    host.dataset.connected = "false";
    label.textContent = "GitHub Pages 作品展示";
    detail.textContent = "这里提供项目说明和固定示例；真实学习后台尚未在公网部署，不会在此索取账户或模型 Key。";
    entry.href = "#trial-status";
    entry.textContent = "查看开放进度";
    retry.hidden = true;
  } else checkService();
})();
