#!/usr/bin/env python3
"""
Pan Site Monitor - 统一的TVBox资源站点监控工具
支持TVBox资源管理、URL测试和GitHub上传功能
"""
import json
import requests
import base64
import os
import zipfile
import shutil
import logging
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Tuple, Optional, Any
import argparse
import sys

try:
    import yaml
    YAML_AVAILABLE = True
except ImportError:
    YAML_AVAILABLE = False

# SSL警告处理将在配置加载后动态设置


class PanSiteMonitor:
    """统一的站点监控工具"""
    
    def __init__(self, config_file: str = None):
        """初始化监控工具"""
        self.base_dir = Path(__file__).parent.parent.absolute()
        self.config = self._load_unified_config(config_file)
        self.last_site = None
        self.session = requests.Session()  # 复用连接
        
    def _load_unified_config(self, config_file: str = None):
        """加载统一配置文件，支持JSON和YAML格式"""
        if config_file is None:
            # 优先尝试YAML格式，如果不存在则使用JSON格式
            yaml_config = self.base_dir / "config" / "app_config.yml"
            json_config = self.base_dir / "config" / "app_config.json"

            if yaml_config.exists() and YAML_AVAILABLE:
                config_file = yaml_config
                print(f"使用YAML配置文件: {config_file}")
            else:
                config_file = json_config
                if not yaml_config.exists():
                    print(f"YAML配置文件不存在，使用JSON配置文件: {config_file}")
                elif not YAML_AVAILABLE:
                    print(f"PyYAML未安装，使用JSON配置文件: {config_file}")
        else:
            config_file = Path(config_file)
            if not config_file.is_absolute():
                config_file = self.base_dir / config_file
        
        # 加载.env文件
        self._load_env_file()
        
        # 加载配置
        config = self._load_config_file(str(config_file))
        
        # 应用环境变量覆盖
        self._apply_env_overrides(config)
        
        # 转换路径
        self._resolve_paths(config)

        # 配置SSL警告处理
        self._configure_ssl_warnings(config)

        # 验证配置完整性
        self._validate_config(config)

        return config
    
    def _load_env_file(self):
        """加载.env文件"""
        env_file = self.base_dir / ".env"
        if env_file.exists():
            try:
                with open(env_file, 'r', encoding='utf-8') as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith('#') and '=' in line:
                            key, value = line.split('=', 1)
                            key = key.strip()
                            value = value.strip()

                            # 安全地移除配对的引号
                            if len(value) >= 2:
                                if (value.startswith('"') and value.endswith('"')) or \
                                   (value.startswith("'") and value.endswith("'")):
                                    value = value[1:-1]

                            if key and value:
                                os.environ[key] = value
                print(f"已加载环境变量文件: {env_file}")
            except Exception as e:
                print(f"加载.env文件失败: {e}")
    
    def _load_config_file(self, config_file: str):
        """加载配置文件，支持JSON和YAML格式"""
        # 最小默认配置结构
        default_config = {
            "sites": {"mapping": {}, "search_paths": {}, "keyword_validation": {}},
            "tvbox": {"local_json_dir": "", "output_path": "", "version_file": "",
                     "download_path": "", "extract_path": "", "old_path": "", "api_timeout": 10,
                     "download_timeout": 60, "download_chunk_size": 8192},
            "url_tester": {"test_timeout": 15,
                          "proxy": {"enabled": False, "proxies": {}}, "history_limit": 24},
            "github": {"owner": "", "repo": "", "branch": "main", "token": "",
                      "files_to_upload": [], "commit_message_template": "Update - {timestamp}",
                      "api_timeout": 30},
            "security": {"verify_ssl": True, "ignore_ssl_warnings": False, "log_sensitive_info": False},
            "logging": {"level": "INFO", "files": {}}
        }

        try:
            if os.path.exists(config_file):
                config_path = Path(config_file)
                is_yaml = config_path.suffix.lower() in ['.yml', '.yaml']

                with open(config_file, 'r', encoding='utf-8') as f:
                    if is_yaml and YAML_AVAILABLE:
                        user_config = yaml.safe_load(f)
                        print(f"已加载YAML配置文件: {config_file}")
                    else:
                        user_config = json.load(f)
                        print(f"已加载JSON配置文件: {config_file}")

                    self._deep_merge(default_config, user_config)
            else:
                # 创建默认配置文件
                os.makedirs(os.path.dirname(config_file), exist_ok=True)
                config_path = Path(config_file)
                is_yaml = config_path.suffix.lower() in ['.yml', '.yaml']

                with open(config_file, 'w', encoding='utf-8') as f:
                    if is_yaml and YAML_AVAILABLE:
                        yaml.dump(default_config, f, default_flow_style=False,
                                allow_unicode=True, indent=2)
                        print(f"已创建默认YAML配置文件: {config_file}")
                    else:
                        json.dump(default_config, f, ensure_ascii=False, indent=2)
                        print(f"已创建默认JSON配置文件: {config_file}")

                print("警告：配置文件中缺少站点配置数据，程序可能无法正常工作")
                if is_yaml:
                    print("请在config/app_config.yml中配置sites节的相关信息")
                else:
                    print("请在config/app_config.json中配置sites节的相关信息")
                print("注意：请编辑配置文件中的敏感信息（如GitHub token）")
        except Exception as e:
            print(f"配置文件加载失败，使用默认配置: {e}")
        
        return default_config

    def _get_config_file_hint(self):
        """获取配置文件提示信息"""
        yaml_config = self.base_dir / "config" / "app_config.yml"
        if yaml_config.exists() and YAML_AVAILABLE:
            return "config/app_config.yml"
        else:
            return "config/app_config.json"

    def _deep_merge(self, target, source):
        """深度合并字典"""
        for key, value in source.items():
            if key in target and isinstance(target[key], dict) and isinstance(value, dict):
                self._deep_merge(target[key], value)
            else:
                target[key] = value
    
    def _apply_env_overrides(self, config):
        """应用环境变量覆盖"""
        # GitHub配置环境变量
        github_config = config.get('github', {})
        env_mappings = {
            'GITHUB_TOKEN': 'token',
            'GITHUB_OWNER': 'owner',
            'GITHUB_REPO': 'repo',
            'GITHUB_BRANCH': 'branch'
        }
        
        for env_var, config_key in env_mappings.items():
            env_value = os.getenv(env_var)
            if env_value:
                github_config[config_key] = env_value
                print(f"已从环境变量 {env_var} 加载配置")
        
        # 其他环境变量
        if os.getenv('GITHUB_API_TIMEOUT'):
            try:
                github_config['api_timeout'] = int(os.getenv('GITHUB_API_TIMEOUT'))
            except ValueError:
                print("警告：GITHUB_API_TIMEOUT 环境变量值无效，使用默认值")
        
        if os.getenv('LOG_LEVEL'):
            config['logging']['level'] = os.getenv('LOG_LEVEL')
    
    def _resolve_paths(self, config):
        """转换相对路径为绝对路径"""
        def resolve_path_in_dict(d, base_dir):
            for key, value in d.items():
                if isinstance(value, dict):
                    resolve_path_in_dict(value, base_dir)
                elif isinstance(value, str) and (key.endswith('_path') or key.endswith('_dir') or key.endswith('_file')):
                    # 排除远程文件名，只处理本地路径
                    if key == 'gitee_zip_file':
                        continue
                    # 检查路径值是否有效
                    if value and value.strip() and not os.path.isabs(value):
                        d[key] = str(base_dir / value)

        resolve_path_in_dict(config, self.base_dir)

    def _configure_ssl_warnings(self, config):
        """配置SSL警告处理"""
        security_config = config.get('security', {})

        if not security_config.get('ignore_ssl_warnings', False):
            # 如果不忽略SSL警告，则不做任何处理（保持默认行为）
            pass
        else:
            # 只有在配置明确要求时才忽略SSL警告
            try:
                import warnings
                from urllib3.exceptions import InsecureRequestWarning
                warnings.simplefilter('ignore', InsecureRequestWarning)
                print("警告：已禁用SSL证书验证警告")
            except ImportError:
                print("警告：无法导入urllib3，SSL警告配置可能无效")

    def _sanitize_config_for_logging(self, config):
        """清理配置中的敏感信息用于日志记录"""
        if not config.get('security', {}).get('log_sensitive_info', False):
            sanitized = json.loads(json.dumps(config))  # 深拷贝

            # 清理GitHub token
            if 'github' in sanitized and 'token' in sanitized['github']:
                token = sanitized['github']['token']
                if token and len(token) > 8:
                    sanitized['github']['token'] = f"{token[:4]}...{token[-4:]}"
                elif token:
                    sanitized['github']['token'] = "***"

            # 清理其他可能的敏感信息
            if 'url_tester' in sanitized and 'proxy' in sanitized['url_tester']:
                proxy_config = sanitized['url_tester']['proxy']
                if 'proxies' in proxy_config:
                    for key, value in proxy_config['proxies'].items():
                        if '@' in str(value):  # 可能包含用户名密码的代理
                            sanitized['url_tester']['proxy']['proxies'][key] = "***"

            return sanitized
        else:
            return config

    def _validate_config(self, config):
        """验证配置完整性"""
        sites_config = config.get('sites', {})

        # 检查站点配置是否为空
        mapping = sites_config.get('mapping', {})
        search_paths = sites_config.get('search_paths', {})
        keyword_validation = sites_config.get('keyword_validation', {})

        if not mapping:
            print("警告：站点映射配置为空，TVBox功能可能无法正常工作")
            print(f"提示：请在{self._get_config_file_hint()}中配置sites.mapping")

        if not search_paths:
            print("警告：搜索路径配置为空，URL测试功能可能无法正常工作")
            print(f"提示：请在{self._get_config_file_hint()}中配置sites.search_paths")

        if not keyword_validation:
            print("警告：关键字验证配置为空，URL测试的准确性可能受影响")
            print(f"提示：请在{self._get_config_file_hint()}中配置sites.keyword_validation")

        # 检查配置一致性
        mapping_sites = set(mapping.values())
        search_sites = set(search_paths.keys())
        keyword_sites = set(keyword_validation.keys())

        missing_search = mapping_sites - search_sites
        missing_keyword = mapping_sites - keyword_sites

        if missing_search:
            print(f"警告：以下站点缺少搜索路径配置: {', '.join(missing_search)}")

        if missing_keyword:
            print(f"警告：以下站点缺少关键字验证配置: {', '.join(missing_keyword)}")

        # 检查其他必要配置
        if not config.get('github', {}).get('token') or config.get('github', {}).get('token', '').startswith('请设置'):
            print("提示：GitHub token未配置，GitHub上传功能将不可用")

        # 检查TVBox路径配置
        self._validate_tvbox_paths(config)

        # 检查TVBox Gitee配置
        self._validate_tvbox_gitee_config(config)

    def _validate_tvbox_paths(self, config):
        """验证TVBox路径配置的合理性"""
        tvbox_config = config.get('tvbox', {})
        extract_path = tvbox_config.get('extract_path', '')
        old_path = tvbox_config.get('old_path', '')

        if extract_path and old_path:
            extract_abs = os.path.abspath(extract_path)
            old_abs = os.path.abspath(old_path)

            # 检查old_path是否在extract_path内部
            if old_abs.startswith(extract_abs + os.sep) or old_abs == extract_abs:
                print(f"错误：TVBox配置中的备份路径 '{old_path}' 不能在解压路径 '{extract_path}' 内部")
                print("建议修改配置文件中的 tvbox.old_path 为独立的目录，例如：")
                print(f"  \"old_path\": \"files_backup\" 或 \"old_path\": \"backup/files\"")
                raise ValueError(f"TVBox路径配置错误：备份路径不能是解压路径的子目录")

    def _validate_tvbox_gitee_config(self, config):
        """验证TVBox Gitee配置的完整性"""
        tvbox_config = config.get('tvbox', {})

        required_gitee_fields = [
            'gitee_repo_owner',
            'gitee_repo_name',
            'gitee_branch',
            'gitee_zip_file'
        ]

        missing_fields = []
        for field in required_gitee_fields:
            if not tvbox_config.get(field):
                missing_fields.append(field)

        if missing_fields:
            print(f"错误：TVBox Gitee配置缺少必要字段: {', '.join(missing_fields)}")
            print(f"提示：请在{self._get_config_file_hint()}中配置以下字段：")
            for field in missing_fields:
                print(f"  tvbox.{field}")
            raise ValueError(f"TVBox Gitee配置不完整")

    def _setup_logging(self, module_name: str):
        """设置日志"""
        try:
            log_level_str = self.config['logging']['level'].upper()
            log_level = getattr(logging, log_level_str)
        except (AttributeError, KeyError):
            print(f"警告：无效的日志级别，使用默认级别 INFO")
            log_level = logging.INFO

        # 确保日志目录存在
        try:
            log_file = str(self.base_dir / self.config['logging']['files'][module_name])
        except KeyError:
            log_file = str(self.base_dir / f"logs/{module_name}.log")

        os.makedirs(os.path.dirname(log_file), exist_ok=True)

        # 获取或创建logger
        logger = logging.getLogger(f"pan_monitor_{module_name}")

        # 如果logger已经有处理器，直接返回
        if logger.handlers:
            return logger

        logger.setLevel(log_level)

        # 创建格式器
        formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')

        # 文件处理器
        file_handler = logging.FileHandler(log_file, encoding='utf-8')
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)

        # 控制台处理器
        console_handler = logging.StreamHandler()
        console_handler.setFormatter(formatter)
        logger.addHandler(console_handler)

        return logger

    def safe_log_config(self, config_section: str = None):
        """安全地记录配置信息（隐藏敏感信息）"""
        if config_section:
            config_to_log = {config_section: self.config.get(config_section, {})}
        else:
            config_to_log = self.config

        sanitized_config = self._sanitize_config_for_logging(config_to_log)
        print(f"当前配置: {json.dumps(sanitized_config, ensure_ascii=False, indent=2)}")

    def safe_print(self, text: str):
        """安全打印函数，处理编码问题"""
        try:
            print(text)
        except UnicodeEncodeError:
            safe_text = text.encode('ascii', 'ignore').decode('ascii')
            print(safe_text)

    def _safe_extract_zip(self, zip_ref: zipfile.ZipFile, extract_path: str):
        """安全解压ZIP文件，防止路径遍历攻击"""
        import os.path

        for member in zip_ref.infolist():
            # 检查文件名是否包含危险路径
            if os.path.isabs(member.filename) or ".." in member.filename:
                raise ValueError(f"不安全的ZIP文件路径: {member.filename}")

            # 确保解压后的路径在目标目录内
            target_path = os.path.join(extract_path, member.filename)
            target_path = os.path.normpath(target_path)

            if not target_path.startswith(os.path.normpath(extract_path)):
                raise ValueError(f"ZIP文件包含路径遍历攻击: {member.filename}")

        # 如果所有文件都安全，则进行解压
        zip_ref.extractall(extract_path)

    # ==================== TVBox管理功能 ====================

    def tvbox_check_version_update(self):
        """检查TVBox版本更新 - 基于Gitee仓库提交哈希"""
        logger = self._setup_logging('tvbox_manager')
        logger.info("检查TVBox版本更新")

        try:
            # 从配置构建Gitee URL
            repo_owner = self.config['tvbox']['gitee_repo_owner']
            repo_name = self.config['tvbox']['gitee_repo_name']
            branch = self.config['tvbox']['gitee_branch']
            zip_file = self.config['tvbox']['gitee_zip_file']

            # 对文件名进行URL编码，避免中文字符问题
            from urllib.parse import quote
            encoded_zip_file = quote(zip_file, safe='')

            gitee_zip_url = f"https://gitee.com/{repo_owner}/{repo_name}/raw/{branch}/{encoded_zip_file}"
            gitee_api_url = f"https://gitee.com/api/v5/repos/{repo_owner}/{repo_name}/commits/{branch}"

            logger.debug(f"构建的下载URL: {gitee_zip_url}")
            logger.debug(f"构建的API URL: {gitee_api_url}")

            verify_ssl = self.config.get('security', {}).get('verify_ssl', True)

            # 调用Gitee API获取最新提交信息
            response = requests.get(
                gitee_api_url,
                timeout=self.config['tvbox']['api_timeout'],
                verify=verify_ssl
            )
            response.raise_for_status()

            # 解析API响应
            commit_data = response.json()
            remote_commit_sha = commit_data.get('sha')
            remote_commit_date = commit_data.get('commit', {}).get('committer', {}).get('date')

            if not remote_commit_sha:
                logger.error("API响应中缺少提交SHA信息")
                return 'error', None, None

            # 格式化提交时间显示
            commit_time_str = ""
            if remote_commit_date:
                try:
                    # Gitee API返回的时间格式: "2024-01-01T12:00:00+08:00" 或 "2024-01-01T12:00:00Z"
                    from datetime import datetime

                    # 处理不同的时间格式
                    if remote_commit_date.endswith('Z'):
                        # UTC时间格式
                        commit_datetime = datetime.fromisoformat(remote_commit_date.replace('Z', '+00:00'))
                    else:
                        # 带时区的时间格式
                        commit_datetime = datetime.fromisoformat(remote_commit_date)

                    # 显示远程时间和本地时间
                    remote_time_str = commit_datetime.strftime('%Y-%m-%d %H:%M:%S %Z')
                    local_time = commit_datetime.astimezone()
                    local_time_str = local_time.strftime('%Y-%m-%d %H:%M:%S')

                    commit_time_str = f" (远程: {remote_time_str}, 本地: {local_time_str})"
                except Exception as e:
                    logger.debug(f"解析提交时间失败: {e}")
                    # 如果解析失败，直接显示原始时间
                    commit_time_str = f" ({remote_commit_date})"

            logger.info(f"远程最新提交SHA: {remote_commit_sha[:8]}...{commit_time_str}")

            # 检查本地版本文件中存储的提交SHA
            version_file = self.config['tvbox']['version_file']
            local_commit_sha = None

            if os.path.exists(version_file):
                try:
                    with open(version_file, 'r', encoding='utf-8') as f:
                        local_commit_sha = f.read().strip()
                except Exception as e:
                    logger.warning(f"读取本地版本文件失败: {e}")

            # 比较提交SHA
            if local_commit_sha == remote_commit_sha:
                logger.info(f"当前版本已是最新 (SHA: {local_commit_sha[:8] if local_commit_sha else '未知'}...{commit_time_str})")
                return 'up_to_date', remote_commit_sha, gitee_zip_url
            else:
                local_short = local_commit_sha[:8] + '...' if local_commit_sha else '未知'
                remote_short = remote_commit_sha[:8] + '...'
                logger.info(f"发现新版本: {remote_short}{commit_time_str} (当前: {local_short})")
                return 'need_update', remote_commit_sha, gitee_zip_url

        except Exception as e:
            logger.error(f"检查版本更新失败: {e}")
            return 'error', None, None

    def tvbox_download_and_update(self, commit_sha: str, url: str):
        """下载并更新TVBox资源 - 从Gitee下载固定ZIP文件"""
        logger = self._setup_logging('tvbox_manager')
        logger.info(f"开始下载更新 (提交SHA: {commit_sha[:8]}...)")

        try:
            # 下载文件
            logger.debug(f"准备下载URL: {url}")
            verify_ssl = self.config.get('security', {}).get('verify_ssl', True)
            response = requests.get(url, timeout=self.config['tvbox']['download_timeout'], stream=True, verify=verify_ssl)
            response.raise_for_status()

            download_path = self.config['tvbox']['download_path']
            os.makedirs(os.path.dirname(download_path), exist_ok=True)

            with open(download_path, 'wb') as f:
                for chunk in response.iter_content(chunk_size=self.config['tvbox']['download_chunk_size']):
                    if chunk:
                        f.write(chunk)

            logger.info(f"下载完成: {download_path}")

            # 解压文件（原子性操作，确保数据安全）
            extract_path = self.config['tvbox']['extract_path']
            old_path = self.config['tvbox']['old_path']
            temp_extract_path = extract_path + "_temp"

            try:
                # 先解压到临时目录
                if os.path.exists(temp_extract_path):
                    shutil.rmtree(temp_extract_path)

                os.makedirs(temp_extract_path, exist_ok=True)

                # 解压新文件（安全解压，防止路径遍历攻击）
                with zipfile.ZipFile(download_path, 'r') as zip_ref:
                    self._safe_extract_zip(zip_ref, temp_extract_path)

                logger.info(f"解压到临时目录完成: {temp_extract_path}")

                # 备份现有文件（如果存在）
                if os.path.exists(extract_path):
                    if os.path.exists(old_path):
                        shutil.rmtree(old_path)
                    shutil.move(extract_path, old_path)
                    logger.info(f"已备份现有文件到: {old_path}")

                # 将临时目录移动到目标位置
                shutil.move(temp_extract_path, extract_path)
                logger.info(f"解压完成: {extract_path}")

            except Exception as e:
                # 如果操作失败，清理临时文件并恢复备份
                if os.path.exists(temp_extract_path):
                    shutil.rmtree(temp_extract_path)

                if os.path.exists(old_path) and not os.path.exists(extract_path):
                    shutil.move(old_path, extract_path)
                    logger.info("已恢复备份文件")

                raise e

            # 更新版本文件，保存提交SHA
            version_file = self.config['tvbox']['version_file']
            os.makedirs(os.path.dirname(version_file), exist_ok=True)
            with open(version_file, 'w', encoding='utf-8') as f:
                f.write(commit_sha)

            logger.info(f"版本更新完成，提交SHA已保存: {commit_sha[:8]}...")
            return True

        except Exception as e:
            logger.error(f"下载更新失败: {e}")
            return False

    def tvbox_aggregate_data(self):
        """聚合TVBox数据"""
        logger = self._setup_logging('tvbox_manager')
        logger.info("开始聚合TVBox数据")

        try:
            local_data = {}
            success_count = 0

            # 检查站点映射配置
            site_mapping = self.config['sites']['mapping']
            if not site_mapping:
                logger.warning("站点映射配置为空，无法进行数据聚合")
                logger.info(f"请在{self._get_config_file_hint()}中配置sites.mapping")
                return False

            total_count = len(site_mapping)
            json_dir = self.config['tvbox']['local_json_dir']

            for filename, site_name in site_mapping.items():
                file_path = os.path.join(json_dir, filename)

                try:
                    if os.path.exists(file_path):
                        with open(file_path, 'r', encoding='utf-8') as f:
                            data = json.load(f)

                        if 'Domains' in data and isinstance(data['Domains'], list):
                            urls = []
                            for domain_info in data['Domains']:
                                if isinstance(domain_info, dict) and 'url' in domain_info:
                                    urls.append(domain_info['url'])
                                elif isinstance(domain_info, str):
                                    urls.append(domain_info)

                            if urls:
                                local_data[site_name] = urls
                                success_count += 1
                                logger.info(f"处理成功: {filename} -> {site_name} ({len(urls)} 个URL)")
                            else:
                                logger.warning(f"文件 {filename} 中未找到有效URL")
                        else:
                            logger.warning(f"文件 {filename} 格式无效")
                    else:
                        logger.warning(f"文件不存在: {file_path}")

                except Exception as e:
                    logger.error(f"处理文件 {filename} 失败: {e}")
                    continue

            # 保存聚合数据
            output_path = self.config['tvbox']['output_path']
            os.makedirs(os.path.dirname(output_path), exist_ok=True)

            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(local_data, f, ensure_ascii=False, indent=2)

            logger.info(f"数据聚合完成: {success_count}/{total_count} 个文件处理成功")
            logger.info(f"数据已保存到: {output_path}")

            return success_count > 0

        except Exception as e:
            logger.error(f"数据聚合失败: {e}")
            return False

    def run_tvbox_manager(self, check_update: bool = True, aggregate_data: bool = True):
        """运行TVBox管理器"""
        logger = self._setup_logging('tvbox_manager')
        logger.info("TVBox管理器启动")

        results = {"update": False, "aggregate": False}

        # 检查并更新版本
        status = None
        if check_update:
            status, commit_sha, url = self.tvbox_check_version_update()

            if status == 'error':
                logger.error("版本检查失败，跳过后续操作")
                return results
            elif status == 'need_update':
                if commit_sha and url:
                    logger.info("发现新版本，开始更新...")
                    results["update"] = self.tvbox_download_and_update(commit_sha, url)
                    if not results["update"]:
                        logger.error("版本更新失败，跳过数据聚合")
                        return results
                else:
                    logger.error("版本信息不完整，跳过更新")
                    return results
            elif status == 'up_to_date':
                logger.info("当前已是最新版本")
                results["update"] = True
        else:
            # 如果跳过版本检查，验证本地文件是否存在
            json_dir = self.config['tvbox']['local_json_dir']
            if not os.path.exists(json_dir):
                logger.warning("跳过版本检查但本地文件不存在，建议先运行版本更新")
            results["update"] = True
            status = 'skip_check'  # 标记为跳过检查

        # 聚合数据 - 只有当版本实际更新或跳过检查时才聚合
        if aggregate_data and results["update"]:
            if status == 'need_update' or status == 'skip_check':
                results["aggregate"] = self.tvbox_aggregate_data()
            elif status == 'up_to_date':
                logger.info("版本无更新，跳过数据聚合")
                results["aggregate"] = True  # 标记为成功，但实际跳过

        logger.info(f"TVBox管理器完成: 更新={results['update']}, 聚合={results['aggregate']}")
        return results

    # ==================== URL测试功能 ====================

    def log_message(self, message, site_name=None, step=""):
        """格式化打印日志消息"""
        status_emojis = {
            '[开始]': '🚀', '[成功]': '✅', '[完成]': '🎉', '[失败]': '❌',
            '[超时]': '⏳', '[警告]': '⚠️', '[错误]': '🚨', '[信息]': 'ℹ️',
            '[选择]': '🔍', '[连接失败]': '🔌'
        }

        if site_name and site_name != self.last_site:
            self.safe_print(f"\n{'✨ ' + '='*38 + ' ✨'}\n🌐 [站点: {site_name}]\n{'✨ ' + '='*38 + ' ✨'}")
            self.last_site = site_name

        for status, emoji in status_emojis.items():
            if status in message:
                message = message.replace(status, emoji)
                break

        if step:
            self.safe_print(f"📋 [{step}] {message}")
        else:
            self.safe_print(f"    {message}")

    def extract_urls_from_sources(self):
        """从数据源提取URL"""
        self.log_message("[开始] 开始提取URL信息", step="提取URL")
        extracted_urls = {}

        # 首先尝试从data/test.json读取（优先级更高）
        test_json_path = self.base_dir / "data" / "test.json"
        if test_json_path.exists():
            self.log_message("[信息] 发现data/test.json，使用此文件作为数据源", step="提取URL")
            try:
                with open(test_json_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)

                # data/test.json格式: {"站点名": ["url1", "url2", ...]}
                for site_name, urls in data.items():
                    if isinstance(urls, list) and urls:
                        # 过滤掉空字符串和无效URL
                        valid_urls = [url.strip() for url in urls if url and url.strip()]
                        if valid_urls:
                            extracted_urls[site_name] = valid_urls
                            self.log_message(f"[成功] {site_name}: 找到 {len(valid_urls)} 个URL",
                                           site_name, "提取URL")
                        else:
                            self.log_message(f"[警告] {site_name} 中未找到有效URL", site_name, "提取URL")
                    else:
                        self.log_message(f"[警告] {site_name} 的URL列表格式无效", site_name, "提取URL")

                self.log_message(f"[完成] 从data/test.json共提取到 {len(extracted_urls)} 个站点的URL信息", step="提取URL")
                return extracted_urls

            except Exception as e:
                self.log_message(f"[错误] 读取data/test.json失败: {e}", step="提取URL")
                # 继续尝试TVBox目录

        # 如果data/test.json不存在或读取失败，尝试从TVBox目录读取
        tvbox_dir = self.config['tvbox']['local_json_dir']

        if not os.path.exists(tvbox_dir):
            self.log_message(f"[错误] TVBox目录不存在: {tvbox_dir}，且data/test.json也不可用", step="提取URL")
            return {}

        self.log_message(f"[信息] 从TVBox目录读取: {tvbox_dir}", step="提取URL")

        # 检查站点映射配置
        site_mapping = self.config['sites']['mapping']
        if not site_mapping:
            self.log_message("[错误] 站点映射配置为空，无法处理TVBox文件", step="提取URL")
            self.log_message(f"[信息] 请在{self._get_config_file_hint()}中配置sites.mapping", step="提取URL")
            return {}

        for filename, site_name in site_mapping.items():
            file_path = os.path.join(tvbox_dir, filename)

            try:
                if os.path.exists(file_path):
                    with open(file_path, 'r', encoding='utf-8') as f:
                        data = json.load(f)

                    # 提取Domains字段中的URL
                    if 'Domains' in data and isinstance(data['Domains'], list):
                        urls = []
                        for domain_info in data['Domains']:
                            if isinstance(domain_info, dict) and 'url' in domain_info:
                                urls.append(domain_info['url'])
                            elif isinstance(domain_info, str):
                                urls.append(domain_info)

                        if urls:
                            extracted_urls[site_name] = urls
                            self.log_message(f"[成功] {filename} -> {site_name}: 找到 {len(urls)} 个URL",
                                           site_name, "提取URL")
                        else:
                            self.log_message(f"[警告] {filename} 中未找到有效URL", site_name, "提取URL")
                    else:
                        self.log_message(f"[警告] {filename} 中未找到Domains字段", site_name, "提取URL")
                else:
                    self.log_message(f"[警告] 文件不存在: {file_path}", step="提取URL")

            except Exception as e:
                self.log_message(f"[错误] 处理文件 {filename} 失败: {e}", step="提取URL")
                continue

        self.log_message(f"[完成] 共提取到 {len(extracted_urls)} 个站点的URL信息", step="提取URL")
        return extracted_urls

    def test_url_availability(self, url, site_name=None):
        """测试单个URL的可用性"""
        search_path = self.config['sites'].get('search_paths', {}).get(site_name)

        # 安全地拼接URL和搜索路径
        if search_path:
            from urllib.parse import urljoin
            base_url = url.strip()
            # 确保base_url以斜杠结尾，以便正确拼接
            if not base_url.endswith('/'):
                base_url += '/'
            test_url_str = urljoin(base_url, search_path.lstrip('/'))
        else:
            test_url_str = url.strip()

        keyword = self.config['sites'].get('keyword_validation', {}).get(site_name)

        # 设置代理
        proxies = None
        proxy_config = self.config.get('url_tester', {}).get('proxy', {})
        if proxy_config.get('enabled', False):
            proxies = proxy_config.get('proxies', {})

        # 设置SSL验证
        verify_ssl = self.config.get('security', {}).get('verify_ssl', True)

        # 设置请求头，模拟真实浏览器
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
        }



        # 重试机制：针对403/503等临时错误
        max_retries = 2
        retry_delay = 1  # 秒

        for attempt in range(max_retries + 1):
            try:
                timeout = self.config.get('url_tester', {}).get('test_timeout', 15)
                response = self.session.get(
                    test_url_str,
                    timeout=timeout,
                    verify=verify_ssl,
                    proxies=proxies,
                    headers=headers,
                    allow_redirects=True
                )
                latency = response.elapsed.total_seconds()

                if response.status_code == 200:
                    has_keyword = keyword in response.text if keyword else True
                    if has_keyword:
                        self.log_message(f"[成功] URL {test_url_str} 延迟: {latency:.2f}s{'，包含关键字 ' + keyword if keyword else ''}",
                                        site_name, "测试URL")
                        return latency, has_keyword, None
                    else:
                        # 无关键字的URL视为无效，返回失败状态
                        self.log_message(f"[失败] URL {test_url_str} 延迟: {latency:.2f}s，但不包含关键字 '{keyword}'",
                                        site_name, "测试URL")
                        self.log_message(f"[判定] 该URL返回200但无关键字，判定为无效（可能是域名过期、Cloudflare盾等）",
                                        site_name, "测试URL")
                        return None, False, {"type": "invalid_content", "detail": "无关键字内容"}
                elif response.status_code in [403, 503, 429] and attempt < max_retries:
                    # 临时错误，重试
                    import time
                    self.log_message(f"[重试] URL {test_url_str} 返回{response.status_code}，{retry_delay}秒后重试 ({attempt + 1}/{max_retries})",
                                    site_name, "测试URL")
                    time.sleep(retry_delay)
                    continue
                else:
                    error_detail = f"状态码 {response.status_code}"
                    self.log_message(f"[失败] URL {test_url_str} 返回HTTP错误: {error_detail}",
                                    site_name, "测试URL")
                    return None, None, {"type": "http_error", "detail": error_detail}
            except requests.exceptions.Timeout:
                if attempt < max_retries:
                    import time
                    self.log_message(f"[重试] URL {test_url_str} 超时，{retry_delay}秒后重试 ({attempt + 1}/{max_retries})",
                                    site_name, "测试URL")
                    time.sleep(retry_delay)
                    continue
                timeout = self.config.get('url_tester', {}).get('test_timeout', 15)
                error_detail = f"请求超时 (>{timeout}s)"
                self.log_message(f"[超时] URL {test_url_str} {error_detail}",
                                site_name, "测试URL")
                return None, None, {"type": "timeout", "detail": "超时"}
            except requests.exceptions.SSLError as e:
                error_detail = f"SSL错误: {str(e)[:100]}"
                self.log_message(f"[SSL错误] URL {test_url_str} {error_detail}", site_name, "测试URL")
                return None, None, {"type": "ssl_error", "detail": "SSL错误"}
            except requests.exceptions.ConnectionError as e:
                if attempt < max_retries:
                    import time
                    self.log_message(f"[重试] URL {test_url_str} 连接失败，{retry_delay}秒后重试 ({attempt + 1}/{max_retries})",
                                    site_name, "测试URL")
                    time.sleep(retry_delay)
                    continue
                error_detail = f"连接失败: {str(e)[:100]}"
                self.log_message(f"[连接失败] URL {test_url_str} {error_detail}", site_name, "测试URL")
                return None, None, {"type": "connection_error", "detail": "连接失败"}
            except Exception as e:
                error_detail = f"测试异常: {str(e)[:100]}"
                self.log_message(f"[错误] URL {test_url_str} {error_detail}", site_name, "测试URL")
                return None, None, {"type": "unknown_error", "detail": "未知错误"}

    def test_site_urls(self, site_name, urls):
        """测试单个站点的所有URL"""
        self.log_message(f"[开始] 开始测试站点 {site_name} 的 {len(urls)} 个URL", site_name, "测试站点")

        url_results = {}
        valid_urls = {}  # 只包含有关键字的有效URL

        for idx, url in enumerate(urls):
            if not url or not url.strip():
                continue

            latency, has_keyword, error_info = self.test_url_availability(url, site_name)

            if latency is not None and has_keyword:
                # 成功：有延迟且包含关键字的URL才算有效
                valid_urls[url] = latency
                url_results[url] = (latency, has_keyword, None, None)
            else:
                # 失败：记录错误信息（包括无关键字的情况）
                url_results[url] = (None, False, None, error_info)

            # 请求间隔：避免触发反爬虫（最后一个URL不需要延迟）
            if idx < len(urls) - 1:
                import time
                time.sleep(0.8)

        # 选择有效URL中延迟最低的
        if valid_urls:
            best_url = min(valid_urls.keys(), key=lambda u: valid_urls[u])
            best_latency = valid_urls[best_url]

            self.log_message(f"[选择] 最佳URL: {best_url} (延迟: {best_latency:.2f}s, 包含关键字)",
                            site_name, "选择最佳")

            return {
                'best_url': best_url,
                'url_results': url_results
            }
        else:
            self.log_message(f"[失败] 站点 {site_name} 没有有效URL", site_name, "测试站点")
            return {'best_url': None, 'url_results': url_results}

    def run_url_tester(self):
        """运行URL测试器"""
        self.log_message("[开始] URL测试器启动", step="主程序")

        # 提取URL
        extracted_urls = self.extract_urls_from_sources()

        if not extracted_urls:
            self.log_message("[错误] 未找到任何URL数据，程序退出", step="主程序")
            return {}

        # 测试所有站点
        results = {}

        for site_name, urls in extracted_urls.items():
            try:
                site_result = self.test_site_urls(site_name, urls)
                results[site_name] = site_result
            except Exception as e:
                self.log_message(f"[错误] 测试站点 {site_name} 时发生异常: {e}", site_name, "测试站点")
                results[site_name] = {'best_url': None, 'url_results': {}}

        # 保存结果
        self.save_monitor_results(results)

        # 统计结果
        success_count = sum(1 for result in results.values() if result['best_url'])
        total_count = len(results)

        self.log_message(f"[完成] URL测试完成: {success_count}/{total_count} 个站点测试成功", step="主程序")
        return results

    def save_monitor_results(self, results):
        """保存前端使用的单一监控数据文件"""
        try:
            # 构建JSON数据
            json_data = {
                "timestamp": datetime.now().isoformat(),
                "summary": {
                    "total_sites": len(results),
                    "success_sites": sum(1 for result in results.values() if result['best_url']),
                    "failed_sites": sum(1 for result in results.values() if not result['best_url'])
                },
                "sites": {}
            }

            for site_name, result in results.items():
                site_data = {
                    "site_name": site_name,
                    "best_url": result['best_url'],
                    "status": "success" if result['best_url'] else "failed",
                    "urls": []
                }

                if 'url_results' in result and result['url_results']:
                    for url, url_result in result['url_results'].items():
                        # 处理数据结构：(latency, has_keyword, weight, error_info)
                        latency, has_keyword, weight, error_info = url_result

                        url_data = {
                            "url": url,
                            "latency": round(latency, 2) if latency is not None else None,
                            "has_keyword": has_keyword,
                            "is_best": url == result['best_url']
                        }

                        # 添加错误信息（如果存在）
                        if error_info:
                            url_data["error_type"] = error_info.get("type")
                            url_data["error_detail"] = error_info.get("detail")

                        site_data['urls'].append(url_data)

                    # 按是否为最佳URL排序，最佳的在前面，失败的URL排在最后
                    site_data['urls'].sort(key=lambda x: (not x['is_best'], x['latency'] is None, x['latency'] or 999))

                json_data['sites'][site_name] = site_data

            # 更新历史数据
            history_data = self.update_history(results)
            if history_data is not None:
                self.save_monitor_data(json_data, history_data)

        except Exception as e:
            self.log_message(f"[错误] 保存监控数据失败: {e}", step="保存结果")

    def save_monitor_data(self, test_data: Dict[str, Any], history_data: Dict[str, Any]):
        """保存前端使用的合并数据快照"""
        try:
            output_file = self.base_dir / "web" / "assets" / "data" / "monitor_data.json"
            os.makedirs(output_file.parent, exist_ok=True)

            monitor_data = {
                **test_data,
                "history": history_data
            }

            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(monitor_data, f, ensure_ascii=False, indent=2)

            self.log_message(f"[成功] 合并监控数据已保存到: {output_file}", step="保存结果")

        except Exception as e:
            self.log_message(f"[错误] 保存合并监控数据失败: {e}", step="保存结果")
            
    def update_history(self, results):
        """更新URL历史状态记录（按网站分类）
        
        从合并数据文件(web/assets/data/monitor_data.json)读取历史记录，
        并返回更新后的历史数据，用于前端展示URL状态的历史变化。
        采用按站点分类的嵌套格式存储: {"站点名": {"URL": [历史记录列表]}}
        每个URL最多保留配置文件中指定数量的最新历史记录。
        """
        try:
            # 读取现有历史记录
            monitor_file = self.base_dir / "web" / "assets" / "data" / "monitor_data.json"
            history_data = {}
            
            if monitor_file.exists():
                try:
                    with open(monitor_file, 'r', encoding='utf-8') as f:
                        monitor_data = json.load(f)
                    existing_history = monitor_data.get("history", {})
                    if isinstance(existing_history, dict):
                        history_data = existing_history
                except Exception as e:
                    self.log_message(f"[警告] 读取历史数据失败: {e}", step="历史记录")
            
            # 获取当前时间戳
            timestamp = datetime.now().isoformat()
            
            # 从配置文件获取历史记录保留数量限制
            history_limit = self.config.get('url_tester', {}).get('history_limit', 12)
            
            # 更新每个URL的历史记录
            for site_name, result in results.items():
                # 确保该站点在历史数据中存在
                if site_name not in history_data:
                    history_data[site_name] = {}
                
                # 只处理URL级历史记录
                if 'url_results' in result:
                    for url, url_result in result['url_results'].items():
                        # 确保该URL在该站点下存在
                        if url not in history_data[site_name]:
                            history_data[site_name][url] = []
                        
                        # 限制URL历史记录数量
                        if len(history_data[site_name][url]) >= history_limit:
                            history_data[site_name][url].pop(0)
                        
                        # 获取URL状态和错误信息
                        if len(url_result) >= 1:
                            latency = url_result[0]  # 获取延迟时间
                        else:
                            latency = None

                        # 获取错误信息（如果存在）
                        error_detail = None
                        if len(url_result) >= 4 and url_result[3]:  # error_info存在
                            error_info = url_result[3]
                            error_detail = error_info.get("detail")

                        # 记录URL状态
                        history_record = {
                            "timestamp": timestamp,
                            "status": "up" if latency is not None else "down",
                            "latency": latency,
                            "is_best": url == result['best_url']
                        }

                        # 添加错误详情（如果存在）
                        if error_detail:
                            history_record["error_detail"] = error_detail

                        history_data[site_name][url].append(history_record)
            
            self.log_message("[成功] URL历史记录已更新", step="历史记录")
            return history_data
        
        except Exception as e:
            self.log_message(f"[错误] 更新历史记录失败: {e}", step="历史记录")
            return None

    # ==================== GitHub上传功能 ====================

    def get_file_sha(self, file_path: str) -> Optional[str]:
        """获取GitHub上文件的SHA值"""
        try:
            github_config = self.config.get('github', {})
            url = f"https://api.github.com/repos/{github_config['owner']}/{github_config['repo']}/contents/{file_path}"

            headers = {
                'Authorization': f"token {github_config['token']}",
                'Accept': 'application/vnd.github.v3+json'
            }

            timeout = github_config.get('api_timeout', 30)
            verify_ssl = self.config.get('security', {}).get('verify_ssl', True)
            response = requests.get(url, headers=headers, timeout=timeout, verify=verify_ssl)

            if response.status_code == 200:
                return response.json().get('sha')
            elif response.status_code == 404:
                return None
            else:
                print(f"获取文件SHA失败: {response.status_code} - {response.text}")
                return None

        except Exception as e:
            print(f"获取文件SHA时发生错误: {e}")
            return None

    def upload_file_to_github(self, local_file_path: str, github_file_path: str) -> bool:
        """上传单个文件到GitHub"""
        try:
            # 检查本地文件是否存在
            full_local_path = self.base_dir / local_file_path
            if not full_local_path.exists():
                print(f"本地文件不存在: {full_local_path}")
                return False

            # 检查文件大小（GitHub API限制单个文件最大100MB）
            file_size = full_local_path.stat().st_size
            max_size = 100 * 1024 * 1024  # 100MB

            if file_size > max_size:
                print(f"文件过大: {file_size / (1024*1024):.2f}MB，超过GitHub API限制(100MB)")
                return False

            if file_size > 10 * 1024 * 1024:  # 10MB以上的文件给出警告
                print(f"警告：文件较大({file_size / (1024*1024):.2f}MB)，上传可能需要较长时间")

            # 读取文件内容并编码
            with open(full_local_path, 'rb') as f:
                file_content = f.read()

            content_base64 = base64.b64encode(file_content).decode('utf-8')

            # 获取现有文件的SHA（如果存在）
            file_sha = self.get_file_sha(github_file_path)

            # 准备API请求
            github_config = self.config.get('github', {})
            url = f"https://api.github.com/repos/{github_config['owner']}/{github_config['repo']}/contents/{github_file_path}"

            headers = {
                'Authorization': f"token {github_config['token']}",
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
            }

            # 生成提交消息
            timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            commit_template = github_config.get('commit_message_template', 'Update {filename} - {timestamp}')
            commit_message = commit_template.format(
                timestamp=timestamp,
                filename=os.path.basename(github_file_path)
            )

            # 构建请求数据
            data = {
                'message': commit_message,
                'content': content_base64,
                'branch': github_config.get('branch', 'main')
            }

            # 如果文件已存在，需要提供SHA
            if file_sha:
                data['sha'] = file_sha
                print(f"更新文件: {github_file_path}")
            else:
                print(f"创建文件: {github_file_path}")

            # 发送请求
            timeout = github_config.get('api_timeout', 30)
            verify_ssl = self.config.get('security', {}).get('verify_ssl', True)
            response = requests.put(url, headers=headers, json=data, timeout=timeout, verify=verify_ssl)

            if response.status_code in [200, 201]:
                print(f"文件上传成功: {github_file_path}")
                return True
            else:
                print(f"文件上传失败: {response.status_code} - {response.text}")
                return False

        except Exception as e:
            print(f"上传文件 {local_file_path} 时发生错误: {e}")
            return False

    def _validate_github_config(self, github_config: dict) -> tuple[bool, list]:
        """验证GitHub配置的有效性"""
        import re

        # 定义配置验证规则
        validation_rules = {
            'owner': {
                'required': True,
                'invalid_patterns': [r'^请设置.*', r'^your-.*', r'^<.*>$', r'^\s*$'],
                'description': 'GitHub用户名或组织名 (环境变量: GITHUB_OWNER)'
            },
            'repo': {
                'required': True,
                'invalid_patterns': [r'^请设置.*', r'^your-.*', r'^<.*>$', r'^\s*$'],
                'description': 'GitHub仓库名 (环境变量: GITHUB_REPO)'
            },
            'token': {
                'required': True,
                'invalid_patterns': [r'^请设置.*', r'^your-.*', r'^<.*>$', r'^\s*$', r'^ghp_example.*'],
                'min_length': 10,
                'description': 'GitHub访问令牌 (环境变量: GITHUB_TOKEN)'
            }
        }

        missing_configs = []

        for field, rules in validation_rules.items():
            value = github_config.get(field, '')

            # 检查是否为必需字段
            if rules.get('required', False) and not value:
                missing_configs.append(rules['description'])
                continue

            # 检查最小长度
            if 'min_length' in rules and len(value) < rules['min_length']:
                missing_configs.append(f"{rules['description']} (长度不足)")
                continue

            # 检查无效模式
            if 'invalid_patterns' in rules:
                for pattern in rules['invalid_patterns']:
                    if re.match(pattern, value, re.IGNORECASE):
                        missing_configs.append(rules['description'])
                        break

        return len(missing_configs) == 0, missing_configs

    def run_github_uploader(self):
        """运行GitHub上传器"""
        print("GitHub上传器启动")

        # 检查配置
        github_config = self.config.get('github', {})
        is_valid, missing_configs = self._validate_github_config(github_config)

        if not is_valid:
            print(f"GitHub配置不完整，缺少: {', '.join(missing_configs)}")
            print("请设置相应的环境变量或编辑配置文件")
            print("注意：请勿在日志或控制台中暴露GitHub token等敏感信息")
            return False

        # 上传文件
        results = {}

        print("开始上传文件到GitHub...")

        files_to_upload = github_config.get('files_to_upload', [])
        for file_config in files_to_upload:
            local_path = file_config['local_path']
            github_path = file_config['github_path']

            print(f"处理文件: {local_path} -> {github_path}")
            success = self.upload_file_to_github(local_path, github_path)
            results[local_path] = success

        # 统计结果
        success_count = sum(1 for success in results.values() if success)
        total_count = len(results)

        print(f"上传完成: {success_count}/{total_count} 个文件成功")

        # 检查是否有失败的上传
        failed_files = [path for path, success in results.items() if not success]
        if failed_files:
            print(f"以下文件上传失败: {failed_files}")
            return False

        print("所有文件上传成功")
        return True


def main():
    """主程序入口"""
    parser = argparse.ArgumentParser(description='Pan Site Monitor - TVBox资源站点监控工具')
    parser.add_argument('command', choices=['tvbox', 'test', 'upload', 'all', 'quick'],
                       help='执行的命令: tvbox(TVBox管理), test(URL测试), upload(GitHub上传), all(全部), quick(快速模式：仅测速+上传)')
    parser.add_argument('--config', default=None, help='配置文件路径')
    parser.add_argument('--no-update', action='store_true', help='跳过TVBox版本检查')
    parser.add_argument('--no-aggregate', action='store_true', help='跳过数据聚合')

    args = parser.parse_args()

    try:
        monitor = PanSiteMonitor(args.config)

        if args.command == 'tvbox':
            print("=== TVBox资源管理 ===")
            results = monitor.run_tvbox_manager(
                check_update=not args.no_update,
                aggregate_data=not args.no_aggregate
            )
            success = results['update'] and results['aggregate']

        elif args.command == 'test':
            print("=== URL可用性测试 ===")
            results = monitor.run_url_tester()
            success = len(results) > 0

        elif args.command == 'upload':
            print("=== GitHub文件上传 ===")
            success = monitor.run_github_uploader()

        elif args.command == 'quick':
            print("=== 快速模式：测速+上传 ===")
            print("ℹ️  跳过TVBox管理，直接使用data/test.json进行测速和上传")

            # 1. URL测试
            print("\n1. URL可用性测试")
            test_results = monitor.run_url_tester()

            if not test_results:
                print("URL测试失败，跳过GitHub上传")
                sys.exit(1)

            # 2. GitHub上传
            print("\n2. GitHub文件上传")
            upload_success = monitor.run_github_uploader()

            success = upload_success

        elif args.command == 'all':
            print("=== 执行完整流程 ===")

            # 1. TVBox管理
            print("\n1. TVBox资源管理")
            tvbox_results = monitor.run_tvbox_manager(
                check_update=not args.no_update,
                aggregate_data=not args.no_aggregate
            )

            if not (tvbox_results['update'] and tvbox_results['aggregate']):
                print("TVBox管理失败，跳过后续步骤")
                sys.exit(1)

            # 2. URL测试
            print("\n2. URL可用性测试")
            test_results = monitor.run_url_tester()

            if not test_results:
                print("URL测试失败，跳过GitHub上传")
                sys.exit(1)

            # 3. GitHub上传
            print("\n3. GitHub文件上传")
            upload_success = monitor.run_github_uploader()

            success = upload_success

        else:
            print(f"未知命令: {args.command}")
            sys.exit(1)

        if success:
            print(f"\n✅ {args.command} 命令执行成功")
            sys.exit(0)
        else:
            print(f"\n❌ {args.command} 命令执行失败")
            sys.exit(1)

    except KeyboardInterrupt:
        print("\n用户中断操作")
        sys.exit(1)
    except Exception as e:
        print(f"\n程序执行异常: {e}")
        # 在生产环境中，应该将详细错误信息记录到日志而不是打印到控制台
        # 避免在控制台输出可能包含敏感信息的完整堆栈跟踪
        try:
            # 确保日志目录存在
            os.makedirs("logs", exist_ok=True)
            
            # 尝试创建一个基本的logger来记录详细错误
            import logging
            error_logger = logging.getLogger("pan_monitor_error")
            if not error_logger.handlers:
                handler = logging.FileHandler("logs/error.log", encoding='utf-8')
                formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
                handler.setFormatter(formatter)
                error_logger.addHandler(handler)
                error_logger.setLevel(logging.ERROR)

            import traceback
            error_logger.error(f"程序异常详情: {traceback.format_exc()}")
            print("详细错误信息已记录到 logs/error.log")
        except Exception as log_error:
            # 如果日志记录也失败，则记录原始异常和日志异常
            print(f"无法记录详细错误信息: {log_error}")
            print(f"原始异常: {e}")

        sys.exit(1)


if __name__ == "__main__":
    main()
