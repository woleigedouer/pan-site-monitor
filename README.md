# pan-site-monitor

一个用于监控TVBox资源站点可用性的自动化工具，支持本地运行和云端部署。

## 🚀 快速部署

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fwoleigedouer%2Fpan-site-monitor)

> 点击上方按钮可一键部署到Vercel，自动创建项目并开始监控

## 🚀 功能特性

- **TVBox资源管理**: 自动下载和更新TVBox资源包
- **站点可用性监控**: 批量测试资源站点的连通性和响应速度
- **智能URL选择**: 从多个镜像URL中自动选择最优的访问地址
- **数据可视化**: 提供现代化的Web仪表板展示监控结果
- **自动化部署**: 支持GitHub自动上传和Vercel云端部署
- **灵活配置**: 支持自定义测试参数和站点配置

## 📁 项目结构

```
pan-site-monitor/
├── src/                    # 核心脚本
│   ├── tvbox_manager.py    # TVBox资源管理器
│   ├── site_url_tester.py  # 站点URL测试器
│   └── github_uploader.py  # GitHub自动上传工具
├── config/                 # 配置文件
│   ├── config.json         # 主配置文件
│   ├── url_tester_config.json  # URL测试配置
│   └── github_config.json  # GitHub上传配置
├── web/                    # Web界面
│   ├── url_status_dashboard.html  # 监控仪表板
│   └── 404.html           # 错误页面
├── data/                   # 数据文件
└── logs/                   # 日志文件
```

## 🛠️ 安装和配置

### 环境要求

- Python 3.7+
- 依赖包：`requests`

### 安装步骤

1. 克隆项目
```bash
git clone https://github.com/your-username/pan-site-monitor.git
cd pan-site-monitor
```

2. 安装依赖
```bash
pip install -r requirements.txt
```

3. 配置文件
   - 复制并修改 `config/` 目录下的配置文件
   - 根据需要配置GitHub token和仓库信息

## 📖 使用说明

### 本地运行模式

1. **TVBox资源管理**
```bash
python src/tvbox_manager.py
```

2. **站点可用性测试**
```bash
python src/site_url_tester.py
```

3. **上传到GitHub**
```bash
python src/github_uploader.py
```

### 部署选项

- **Vercel部署**: 使用上方一键部署按钮，或手动连接GitHub仓库到Vercel
- **本地部署**: 直接运行脚本并配置定时任务

## ⚙️ 配置说明

### 主要配置文件

- `config/config.json`: TVBox资源管理配置
- `config/url_tester_config.json`: URL测试参数配置
- `config/github_config.json`: GitHub自动上传配置

### 支持的资源站点

项目默认支持以下TVBox资源站点：
- 玩偶、木偶、蜡笔、至臻、多多
- 欧哥、二小、虎斑、闪电

## 📊 监控仪表板

访问 `web/url_status_dashboard.html` 查看：
- 站点实时状态
- 响应时间统计
- 可用性历史记录
- 最优URL推荐

## 🔧 开发和贡献

欢迎提交Issue和Pull Request来改进项目。

## 📄 许可证

本项目采用MIT许可证，详见LICENSE文件。