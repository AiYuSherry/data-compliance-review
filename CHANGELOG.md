# 更新日志

格式参考：[日期] — 修改人 — 一句话总结

---

## 2026-04-09

### 前端改为蓝白 SaaS 风格（你）
- 将 `index.html` 与 `result.html` 整体色调改回蓝白 SaaS 风格（Inter + Noto Sans SC、primary-500 `#3b66f5`）
- 保留优化后的结果页结构：Executive Summary、Sticky 侧边导航、风险详情卡片左右分栏、法规/证据折叠
- **文件改动**：`data-compliance-web/templates/index.html`、`data-compliance-web/templates/result.html`

### 前端样式回滚 + 功能保留（你）
- 将 SaaS 蓝白风格回滚为 original editorial 风格（衬线体、金棕装饰线、灰褐主色）
- 保留并优化了全部功能模块展示：风险聚类、整改任务、证据清单、专项审查包
- 中风险/P2/自动复核 统一从金黄色替换为深灰褐（`#635a4d`），解决视觉疲劳问题
- **文件改动**：`data-compliance-web/templates/index.html`、`data-compliance-web/templates/result.html`

### GitHub 仓库初始化 + 协作文档
- 初始化 Git 仓库，推送到 `https://github.com/AiYuSherry/data-compliance-review`
- 新增 `.gitignore`、`API_CONTRACT.md`、`TEAM_STATUS.md`、`CHANGELOG.md`

### Bug 修复
- 修复 `app.py` 因 `selected_paths` 后端输出为 `dict` 列表导致的 `TypeError: unhashable type: 'dict'`
- 新增 `/dev/result` mock 路由，方便前端独立开发

---

> 提示：你的朋友可以在 GitHub 仓库页面点右上角 **Watch → All activity**，这样每次 push 都会收到邮件通知，实现自动同步。
