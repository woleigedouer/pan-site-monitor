#!/usr/bin/env python3
import json
import requests
import os
import zipfile
import shutil
import logging
from typing import Dict, Optional, Tuple
from pathlib import Path

class TVBoxManager:
    def __init__(self, config_file: str = None):
        """初始化TVBox管理器"""
        # 获取项目根目录（脚本文件的上两级目录）
        self.base_dir = Path(__file__).parent.parent.absolute()

        # 设置默认配置文件路径
        if config_file is None:
            config_file = self.base_dir / "config" / "config.json"
        else:
            config_file = Path(config_file)
            if not config_file.is_absolute():
                config_file = self.base_dir / config_file

        self.config_file = str(config_file)
        self.config = self.load_config()
        self.setup_logging()
    
    def load_config(self) -> Dict:
        """加载配置文件"""
        default_config = {
            "online_files_config": {
                "wogg.json": {"Domains": "玩偶"},
                "mogg.json": {"Domains": "木偶"},
                "lb.json": {"Domains": "蜡笔"},
                "zz.json": {"Domains": "至臻"},
                "yyds.json": {"Domains": "多多"},
                "og.json": {"Domains": "欧哥"},
                "ex.json": {"Domains": "二小"},
                "hb.json": {"Domains": "虎斑"},
                "sd.json": {"Domains": "闪电"}
            },
            "local_json_dir": str(self.base_dir / "files" / "TVBoxOSC" / "tvbox" / "json"),
            "output_path": str(self.base_dir / "data" / "test.json"),
            "api_url": "https://9877.kstore.space/Market/single.json",
            "version_file": str(self.base_dir / "data" / "xs_version.txt"),
            "download_path": str(self.base_dir / "data" / "xs.zip"),
            "extract_path": str(self.base_dir / "files"),
            "old_path": str(self.base_dir / "files" / "TVBoxOSC"),
            "api_timeout": 10,
            "download_timeout": 60,
            "download_chunk_size": 8192,
            "log_file": str(self.base_dir / "logs" / "tvbox_manager.log"),
            "log_level": "INFO"
        }
        
        try:
            if os.path.exists(self.config_file):
                with open(self.config_file, 'r', encoding='utf-8') as f:
                    user_config = json.load(f)
                    # 将配置文件中的相对路径转换为基于项目根目录的绝对路径
                    for key, value in user_config.items():
                        if key.endswith('_path') or key.endswith('_dir') or key.endswith('_file'):
                            if isinstance(value, str) and not os.path.isabs(value):
                                user_config[key] = str(self.base_dir / value)
                    default_config.update(user_config)
            else:
                # 创建默认配置文件
                with open(self.config_file, 'w', encoding='utf-8') as f:
                    json.dump(default_config, f, ensure_ascii=False, indent=4)
        except Exception as e:
            print(f"配置文件加载失败，使用默认配置: {e}")

        return default_config
    
    def setup_logging(self):
        """设置日志"""
        try:
            log_level_str = self.config.get('log_level', 'INFO').upper()
            log_level = getattr(logging, log_level_str)
        except AttributeError:
            print(f"警告：无效的日志级别 '{log_level_str}'，使用默认级别 INFO")
            log_level = logging.INFO

        # 确保日志目录存在
        self.ensure_directory(self.config['log_file'])

        logging.basicConfig(
            level=log_level,
            format='%(asctime)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler(self.config['log_file'], encoding='utf-8'),
                logging.StreamHandler()
            ]
        )
        self.logger = logging.getLogger(__name__)

    def ensure_directory(self, file_path: str):
        """确保文件所在目录存在"""
        directory = os.path.dirname(file_path)
        if directory:
            os.makedirs(directory, exist_ok=True)
    
    def check_version_update(self) -> Tuple[str, Optional[str], Optional[str]]:
        """检查版本更新
        返回: (状态, 版本号, 下载链接)
        状态: 'need_update', 'up_to_date', 'force_update', 'error'
        """
        try:
            self.logger.info("检查版本更新...")
            response = requests.get(self.config['api_url'], timeout=self.config['api_timeout'])
            response.raise_for_status()
            api_data = response.json()

            # 提取版本信息 - 使用更灵活的解析方式
            new_version = None
            download_url = None

            try:
                for item in api_data:
                    if item.get('name') == '本地包':
                        for sub_item in item.get('list', []):
                            if sub_item.get('name') == '点击下载':
                                new_version = sub_item.get('version')
                                download_url = sub_item.get('url')
                                break
                        if new_version and download_url:
                            break
            except (TypeError, KeyError) as e:
                self.logger.error(f"API数据格式解析失败: {e}")
                return 'error', None, None

            if not new_version or not download_url:
                self.logger.warning("未找到完整的版本信息")
                return 'error', None, None

            # 读取当前版本
            current_version = ""
            if os.path.exists(self.config['version_file']):
                try:
                    with open(self.config['version_file'], 'r', encoding='utf-8') as f:
                        current_version = f.read().strip()
                except Exception as e:
                    self.logger.warning(f"读取版本文件失败: {e}")
                    current_version = ""

            self.logger.info(f"当前版本: {current_version}, 最新版本: {new_version}")

            # 检查是否需要强制更新（首次运行或关键文件缺失）
            json_dir = self.config.get('local_json_dir', str(self.base_dir / "files" / "TVBoxOSC" / "tvbox" / "json"))
            if not current_version or not os.path.exists(json_dir):
                self.logger.info("检测到首次运行或文件缺失，将强制更新")
                return 'force_update', new_version, download_url

            if current_version != new_version:
                return 'need_update', new_version, download_url
            else:
                return 'up_to_date', new_version, download_url

        except Exception as e:
            self.logger.error(f"检查版本更新失败: {e}")
            return 'error', None, None
    
    def download_and_update(self, version: str, url: str) -> bool:
        """下载并更新文件"""
        try:
            self.logger.info(f"开始下载新版本 {version}...")

            # 确保目录存在
            self.ensure_directory(self.config['download_path'])
            self.ensure_directory(self.config['version_file'])

            # 下载文件
            response = requests.get(url, timeout=self.config['download_timeout'], stream=True)
            response.raise_for_status()

            download_size = 0
            chunk_size = self.config['download_chunk_size']
            with open(self.config['download_path'], 'wb') as f:
                for chunk in response.iter_content(chunk_size=chunk_size):
                    f.write(chunk)
                    download_size += len(chunk)

            self.logger.info(f"下载完成，文件大小: {download_size} 字节")

            # 验证下载文件
            if download_size == 0:
                raise Exception("下载文件为空")

            # 删除旧文件
            if os.path.exists(self.config['old_path']):
                shutil.rmtree(self.config['old_path'])
                self.logger.info("已删除旧文件")

            self.logger.info("开始解压...")

            # 解压文件
            try:
                with zipfile.ZipFile(self.config['download_path'], 'r') as zip_ref:
                    zip_ref.extractall(self.config['extract_path'])
            except zipfile.BadZipFile:
                raise Exception("下载的文件不是有效的ZIP文件")
            except Exception as e:
                # 清理可能的部分解压文件
                if os.path.exists(self.config['old_path']):
                    try:
                        shutil.rmtree(self.config['old_path'])
                    except:
                        pass
                raise Exception(f"解压失败: {e}")

            # 验证解压结果
            json_dir = self.config.get('local_json_dir', str(self.base_dir / "files" / "TVBoxOSC" / "tvbox" / "json"))
            if not os.path.exists(json_dir):
                raise Exception(f"解压后未找到JSON目录: {json_dir}")

            # 检查是否有JSON文件
            json_files = [f for f in os.listdir(json_dir) if f.endswith('.json')]
            if not json_files:
                self.logger.warning(f"JSON目录中没有找到.json文件: {json_dir}")
            else:
                self.logger.info(f"找到 {len(json_files)} 个JSON文件")

            # 更新版本文件
            try:
                with open(self.config['version_file'], 'w', encoding='utf-8') as f:
                    f.write(version)
            except Exception as e:
                self.logger.error(f"写入版本文件失败: {e}")
                # 不影响主流程，继续执行

            # 清理下载文件
            os.remove(self.config['download_path'])

            self.logger.info(f"更新完成，版本: {version}")
            return True

        except Exception as e:
            self.logger.error(f"下载更新失败: {e}")
            # 清理可能的残留文件
            if os.path.exists(self.config['download_path']):
                try:
                    os.remove(self.config['download_path'])
                except:
                    pass
            return False
    
    def safe_write_json(self, data: dict, file_path: str):
        """原子写入JSON文件"""
        temp_path = file_path + '.tmp'
        backup_path = file_path + '.bak'
        try:
            with open(temp_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=4)
            # 原子替换
            if os.path.exists(file_path):
                shutil.move(file_path, backup_path)
            shutil.move(temp_path, file_path)
            # 删除备份文件
            if os.path.exists(backup_path):
                os.remove(backup_path)
        except Exception as e:
            # 清理临时文件
            if os.path.exists(temp_path):
                os.remove(temp_path)
            # 恢复备份文件
            if os.path.exists(backup_path) and not os.path.exists(file_path):
                shutil.move(backup_path, file_path)
            raise e

    def aggregate_json_data(self) -> bool:
        """聚合JSON数据"""
        try:
            self.logger.info("开始聚合JSON数据...")

            # 确保输出目录存在
            self.ensure_directory(self.config['output_path'])

            # 初始化本地数据（不需要加载现有文件，因为会完全重写）
            local_data = {}

            # 处理每个本地文件
            success_count = 0
            total_count = len(self.config['online_files_config'])

            # 检查本地JSON文件目录
            local_json_dir = self.config.get('local_json_dir', str(self.base_dir / "files" / "TVBoxOSC" / "tvbox" / "json"))

            for filename, field_mapping in self.config['online_files_config'].items():
                local_file_path = os.path.join(local_json_dir, filename)
                try:
                    if os.path.exists(local_file_path):
                        with open(local_file_path, 'r', encoding='utf-8') as f:
                            local_file_data = json.load(f)

                        # 提取并重命名字段
                        for old_field, new_field in field_mapping.items():
                            if old_field in local_file_data:
                                local_data[new_field] = local_file_data[old_field]
                                self.logger.info(f"成功处理 {filename}: {old_field} -> {new_field}")
                            else:
                                self.logger.warning(f"{filename} 中未找到字段 {old_field}")

                        success_count += 1
                    else:
                        self.logger.warning(f"本地文件不存在: {local_file_path}")

                except Exception as e:
                    self.logger.error(f"处理本地文件 {local_file_path} 失败: {e}")
                    continue

            # 原子保存合并后的数据
            self.safe_write_json(local_data, self.config['output_path'])

            self.logger.info(f"数据聚合完成: {success_count}/{total_count} 个文件处理成功")
            self.logger.info(f"数据已保存到: {self.config['output_path']}")

            return success_count > 0

        except Exception as e:
            self.logger.error(f"数据聚合失败: {e}")
            return False
    
    def run(self, check_update: bool = True, aggregate_data: bool = True):
        """运行主程序"""
        self.logger.info("TVBox管理器启动")

        results = {"update": False, "aggregate": False}

        # 检查并更新版本
        if check_update:
            status, version, url = self.check_version_update()

            if status == 'error':
                self.logger.error("版本检查失败，跳过后续操作")
                return results
            elif status in ['need_update', 'force_update']:
                if version and url:
                    self.logger.info(f"{'发现新版本' if status == 'need_update' else '强制更新'}，开始更新...")
                    results["update"] = self.download_and_update(version, url)
                    if not results["update"]:
                        self.logger.error("版本更新失败，跳过数据聚合")
                        return results
                else:
                    self.logger.error("版本信息不完整，跳过更新")
                    return results
            elif status == 'up_to_date':
                self.logger.info("当前已是最新版本")
                results["update"] = True
        else:
            # 如果跳过版本检查，验证本地文件是否存在
            json_dir = self.config.get('local_json_dir', str(self.base_dir / "files" / "TVBoxOSC" / "tvbox" / "json"))
            if not os.path.exists(json_dir):
                self.logger.warning("跳过版本检查但本地文件不存在，建议先运行版本更新")
            results["update"] = True

        # 聚合数据（仅在版本更新成功或跳过检查时执行）
        if aggregate_data and results["update"]:
            results["aggregate"] = self.aggregate_json_data()
        elif aggregate_data:
            self.logger.warning("由于版本更新失败，跳过数据聚合")

        # 输出结果
        if check_update and aggregate_data:
            if results["update"] and results["aggregate"]:
                self.logger.info("所有任务完成成功")
            elif not results["update"]:
                self.logger.error("版本更新失败")
            elif not results["aggregate"]:
                self.logger.error("数据聚合失败")
        elif check_update and results["update"]:
            self.logger.info("版本更新完成")
        elif aggregate_data and results["aggregate"]:
            self.logger.info("数据聚合完成")

        return results

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='TVBox资源管理器')
    parser.add_argument('--no-update', action='store_true', help='跳过版本检查和更新')
    parser.add_argument('--no-aggregate', action='store_true', help='跳过数据聚合')
    parser.add_argument('--config', default='config/config.json', help='配置文件路径')
    
    args = parser.parse_args()
    
    manager = TVBoxManager(args.config)
    manager.run(
        check_update=not args.no_update,
        aggregate_data=not args.no_aggregate
    )
