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
├── config/                 # 配置文件
│   ├── app_config.yml      # 统一配置文件（YAML格式，推荐）
│   └── app_config.json     # 统一配置文件（JSON格式，兼容）
├── data/                   # 数据文件目录
│   └── test.json           # 测试配置数据
├── logs/                   # 日志文件目录
├── src/                    # 核心脚本
│   └── pan_site_monitor.py # 统一监控工具（3合1）
├── web/                    # Web界面
│   ├── index.html          # 监控仪表板主页面
│   └── assets/             # 静态资源
│       ├── css/            # 样式文件
│       │   ├── main.css    # 主样式文件（统一入口）
│       │   ├── variables.css    # CSS变量、重置样式、基础样式
│       │   ├── countdown.css    # 倒计时头部样式
│       │   ├── site-components.css  # 头部、站点卡片、状态指示器等组件
│       │   └── responsive.css   # 移动端适配样式
│       ├── data/           # 前端数据文件
│       │   ├── test_results.json   # 测试结果数据
│       │   └── history.json       # 历史监控数据
│       └── js/             # JavaScript模块
│           ├── main.js     # 模块加载器（支持ES6模块和回退）
│           ├── app.js      # 主应用入口和初始化
│           ├── config.js   # 应用配置常量
│           ├── state.js    # 应用状态管理
│           ├── utils.js    # 工具函数模块
│           ├── ui/         # UI组件模块
│           │   ├── countdown.js  # 倒计时功能
│           │   ├── events.js     # 事件处理
│           │   └── tooltip.js    # 工具提示系统
│           └── data/       # 数据处理模块
│               ├── loader.js     # 数据加载
│               └── renderer.js   # 数据渲染
├── .env.example           # 环境变量配置示例
├── .gitignore             # Git忽略文件配置
├── README.md              # 项目说明文档
├── requirements.txt        # Python依赖包
└── vercel.json            # Vercel部署配置
```

## 🛠️ 安装和配置

### 环境要求

- Python 3.7+
- 依赖包：`requests`, `PyYAML` (可选，用于YAML配置支持)

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

3. 配置环境变量（推荐）
   ```bash
   # 复制环境变量示例文件
   cp .env.example .env
   # 编辑.env文件，填入实际的GitHub信息
   ```

4. 或者配置文件
   - 复制并修改 `config/` 目录下的配置文件
   - 根据需要配置GitHub token和仓库信息（不推荐，存在安全风险）

## 📖 使用说明

### 本地运行模式

1. **TVBox资源管理**
```bash
python src/pan_site_monitor.py tvbox
```

2. **站点可用性测试**
```bash
python src/pan_site_monitor.py test
```

3. **上传到GitHub**
```bash
python src/pan_site_monitor.py upload
```

4. **完整流程（推荐）**
```bash
python src/pan_site_monitor.py all
```

### 命令选项

#### TVBox管理选项
```bash
# 跳过版本检查，只做数据聚合
python src/pan_site_monitor.py tvbox --no-update

# 跳过数据聚合，只检查更新
python src/pan_site_monitor.py tvbox --no-aggregate

# 完整流程但跳过TVBox版本检查
python src/pan_site_monitor.py all --no-update
```

#### 自定义配置文件
```bash
# 使用自定义配置文件
python src/pan_site_monitor.py all --config path/to/your/config.json
```

### 部署选项

- **Vercel部署**: 使用上方一键部署按钮，或手动连接GitHub仓库到Vercel
- **本地部署**: 直接运行脚本并配置定时任务

## ⚙️ 配置说明

### 主要配置文件

项目支持两种配置文件格式，程序会自动选择：

- `config/app_config.yml`: YAML格式配置文件（**推荐**）
  - ✅ 支持注释，提高可读性
  - ✅ 语法简洁，层次清晰
  - ✅ 易于维护和理解
  - ⚠️ 需要安装 `PyYAML>=5.4.0`

- `config/app_config.json`: JSON格式配置文件（兼容）
  - ✅ 无额外依赖
  - ❌ 不支持注释
  - ❌ 语法相对冗长

- `.env`: 环境变量配置（敏感信息，推荐使用）

**自动选择逻辑：**
1. 如果存在 `app_config.yml` 且安装了 PyYAML → 使用YAML格式
2. 否则使用 `app_config.json`

### 配置文件格式对比

**YAML格式示例 (推荐)：**
```yaml
# 站点配置 - TVBox资源站点相关设置
sites:
  # 站点映射 - JSON文件名到站点显示名称的映射
  mapping:
    wogg.json: "玩偶"      # 玩偶站点
    mogg.json: "木偶"      # 木偶站点

  # 搜索路径配置
  search_paths:
    玩偶: "/vodsearch/-------------.html?wd=仙台有树"
    木偶: "/index.php/vod/search.html?wd=仙台有树"
```

**JSON格式示例 (兼容)：**
```json
{
  "sites": {
    "mapping": {
      "wogg.json": "玩偶",
      "mogg.json": "木偶"
    },
    "search_paths": {
      "玩偶": "/vodsearch/-------------.html?wd=仙台有树",
      "木偶": "/index.php/vod/search.html?wd=仙台有树"
    }
  }
}
```

### 支持的资源站点

项目默认支持以下TVBox资源站点：
- 玩偶、木偶、蜡笔、至臻、多多
- 欧哥、二小、虎斑、闪电、小斑

## 📊 监控仪表板

访问 `web/index.html` 查看：
- 站点实时状态
- 响应时间统计
- 可用性历史记录
- 最优URL推荐

### 前端架构

#### 🎯 模块化JavaScript架构
- **ES6模块化**: 支持现代浏览器的原生模块系统
- **智能加载器**: 自动检测浏览器支持，提供回退机制
- **模块分离**: 按功能拆分为10个独立模块
  - `main.js` - 模块加载器和兼容性处理
  - `app.js` - 主应用入口和初始化逻辑
  - `config.js` - 应用配置常量管理
  - `state.js` - 全局状态管理
  - `utils.js` - 通用工具函数
  - `ui/countdown.js` - 倒计时功能模块
  - `ui/events.js` - 用户交互事件处理
  - `ui/tooltip.js` - 工具提示系统
  - `data/loader.js` - 数据获取和加载逻辑
  - `data/renderer.js` - 数据渲染和HTML生成

#### 🎨 样式架构
- **模块化CSS**: 样式文件按功能拆分，便于维护
- **CSS Grid + Flexbox**: 现代布局技术，精确控制和灵活适配
- **响应式设计**: 支持桌面端和移动端访问
- **CSS变量**: 统一的设计系统和主题管理

#### ⚡ 性能特性
- **自动加载**: 页面打开即自动加载数据
- **实时更新**: 自动刷新监控数据和倒计时
- **向后兼容**: 支持不同版本的浏览器
- **现代化UI**: 采用现代Web设计规范

#### 🔧 技术特性
- **零依赖**: 前端无需构建工具，直接运行
- **模块热加载**: 支持开发时的模块更新
- **错误处理**: 完善的错误处理和回退机制
- **代码分离**: 关注点分离，便于维护和扩展

## 🔒 环境变量配置

为了提高安全性，本项目支持使用环境变量来管理敏感信息，避免将GitHub token等敏感数据直接存储在配置文件中。

### 支持的环境变量

#### GitHub相关配置
- `GITHUB_TOKEN`: GitHub Personal Access Token（必需）
- `GITHUB_OWNER`: GitHub用户名或组织名（必需）
- `GITHUB_REPO`: GitHub仓库名（必需）
- `GITHUB_BRANCH`: 目标分支，默认为 `main`

#### 其他配置
- `GITHUB_API_TIMEOUT`: API请求超时时间（秒），默认为30
- `LOG_LEVEL`: 日志级别，默认为INFO

### 配置方法

#### 方法1：使用.env文件（推荐）

1. 创建`.env`文件：
```bash
GITHUB_TOKEN=ghp_your_actual_token_here
GITHUB_OWNER=your-username
GITHUB_REPO=your-repo-name
GITHUB_BRANCH=main
```

2. 运行程序时会自动加载`.env`文件中的环境变量

#### 方法2：系统环境变量

**Linux/macOS:**
```bash
export GITHUB_TOKEN=ghp_your_actual_token_here
export GITHUB_OWNER=your-username
export GITHUB_REPO=your-repo-name
```

**Windows (PowerShell):**
```powershell
$env:GITHUB_TOKEN="ghp_your_actual_token_here"
$env:GITHUB_OWNER="your-username"
$env:GITHUB_REPO="your-repo-name"
```

### 安全建议

1. **不要将.env文件提交到版本控制系统**
2. **定期更新GitHub token**
3. **使用最小权限原则** - 只给token必需的权限
4. **环境隔离** - 开发、测试、生产环境使用不同的token

## 🔧 故障排除

### 配置相关问题

#### GitHub配置不完整
如果看到"GitHub配置不完整"错误：
1. 检查环境变量是否正确设置
2. 确认.env文件是否存在且格式正确
3. 验证token是否有效且权限足够

#### 站点配置为空
如果看到站点配置相关警告：
1. 检查配置文件中的sites配置（`config/app_config.yml` 或 `config/app_config.json`）
2. 确保mapping、search_paths、keyword_validation都已配置
3. 参考现有配置添加新站点

#### YAML配置相关问题
如果使用YAML格式遇到问题：

**PyYAML未安装：**
- 错误信息：`PyYAML未安装，使用JSON配置文件`
- 解决方案：运行 `pip install PyYAML>=5.4.0`

**YAML语法错误：**
- 检查缩进是否正确（使用空格，不要使用Tab）
- 检查冒号后是否有空格
- 检查字符串是否需要引号
- 使用在线YAML验证器检查语法

### 网络相关问题

#### SSL证书验证失败
如果遇到SSL相关错误：
1. 检查配置文件中的security.verify_ssl设置
2. 临时禁用SSL验证：设置 `verify_ssl: false` (YAML) 或 `"verify_ssl": false` (JSON)
3. 检查网络连接和防火墙设置

#### 代理配置
如果需要使用代理：

**YAML格式 (app_config.yml)：**
```yaml
url_tester:
  proxy:
    enabled: true
    proxies:
      http: "http://proxy.example.com:8080"
      https: "https://proxy.example.com:8080"
```

**JSON格式 (app_config.json)：**
```json
{
  "url_tester": {
    "proxy": {
      "enabled": true,
      "proxies": {
        "http": "http://proxy.example.com:8080",
        "https": "https://proxy.example.com:8080"
      }
    }
  }
}
```

### 权限相关问题

#### GitHub API权限错误
如果遇到403权限错误：
1. 确认token具有repo权限
2. 检查用户名和仓库名是否正确
3. 验证token是否过期

- **推荐使用环境变量**：将GitHub token等敏感信息存储在环境变量中
- **避免配置文件存储敏感信息**：不要将token直接写入配置文件
- **使用.env文件**：本地开发时可使用.env文件管理环境变量
- **详细配置说明**：参见 [环境变量配置指南](docs/ENVIRONMENT_SETUP.md)

## 🔧 开发和贡献

欢迎提交Issue和Pull Request来改进项目。

## 📄 许可证

本项目采用MIT许可证，详见LICENSE文件。