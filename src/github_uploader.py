#!/usr/bin/env python3
import json
import requests
import base64
import os
from pathlib import Path
from typing import Optional, Dict, Any
import logging

class GitHubUploader:
    def __init__(self, config_file: str = None):
        """初始化GitHub上传器"""
        # 获取项目根目录
        self.base_dir = Path(__file__).parent.parent.absolute()
        
        # 设置默认配置文件路径
        if config_file is None:
            config_file = self.base_dir / "config" / "github_config.json"
        else:
            config_file = Path(config_file)
            if not config_file.is_absolute():
                config_file = self.base_dir / config_file
        
        self.config_file = str(config_file)
        self.config = self.load_config()
        self.setup_logging()
    
    def load_config(self) -> Dict[str, Any]:
        """加载配置文件"""
        default_config = {
            "github": {
                "owner": "your-username",
                "repo": "your-repo-name", 
                "branch": "main",
                "token": "your-github-token"
            },
            "files_to_upload": [
                {
                    "local_path": "data/test_results.json",
                    "github_path": "data/test_results.json"
                },
                {
                    "local_path": "data/test.json", 
                    "github_path": "data/test.json"
                }
            ],
            "commit_message_template": "Update test results - {timestamp}",
            "api_timeout": 30,
            "log_file": "logs/github_uploader.log",
            "log_level": "INFO"
        }
        
        try:
            if os.path.exists(self.config_file):
                with open(self.config_file, 'r', encoding='utf-8') as f:
                    user_config = json.load(f)
                    # 合并配置
                    default_config.update(user_config)
            else:
                # 创建默认配置文件
                self.ensure_directory(self.config_file)
                with open(self.config_file, 'w', encoding='utf-8') as f:
                    json.dump(default_config, f, ensure_ascii=False, indent=2)
                print(f"已创建默认配置文件: {self.config_file}")
                print("请编辑配置文件，填入正确的GitHub信息")
        except Exception as e:
            print(f"配置文件加载失败: {e}")
            
        return default_config
    
    def ensure_directory(self, file_path: str):
        """确保文件所在目录存在"""
        directory = os.path.dirname(file_path)
        if directory:
            os.makedirs(directory, exist_ok=True)
    
    def setup_logging(self):
        """设置日志"""
        try:
            log_level_str = self.config.get('log_level', 'INFO').upper()
            log_level = getattr(logging, log_level_str)
        except AttributeError:
            print(f"警告：无效的日志级别 '{log_level_str}'，使用默认级别 INFO")
            log_level = logging.INFO
        
        # 确保日志目录存在
        log_file = str(self.base_dir / self.config['log_file'])
        self.ensure_directory(log_file)
        
        logging.basicConfig(
            level=log_level,
            format='%(asctime)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler(log_file, encoding='utf-8'),
                logging.StreamHandler()
            ]
        )
        self.logger = logging.getLogger(__name__)
    
    def get_file_sha(self, file_path: str) -> Optional[str]:
        """获取GitHub上文件的SHA值"""
        try:
            github_config = self.config['github']
            url = f"https://api.github.com/repos/{github_config['owner']}/{github_config['repo']}/contents/{file_path}"
            
            headers = {
                'Authorization': f"token {github_config['token']}",
                'Accept': 'application/vnd.github.v3+json'
            }
            
            response = requests.get(url, headers=headers, timeout=self.config['api_timeout'])
            
            if response.status_code == 200:
                return response.json().get('sha')
            elif response.status_code == 404:
                # 文件不存在，返回None
                return None
            else:
                self.logger.warning(f"获取文件SHA失败: {response.status_code} - {response.text}")
                return None
                
        except Exception as e:
            self.logger.error(f"获取文件SHA时发生错误: {e}")
            return None
    
    def upload_file(self, local_file_path: str, github_file_path: str) -> bool:
        """上传单个文件到GitHub"""
        try:
            # 检查本地文件是否存在
            full_local_path = self.base_dir / local_file_path
            if not full_local_path.exists():
                self.logger.warning(f"本地文件不存在: {full_local_path}")
                return False
            
            # 读取文件内容并编码
            with open(full_local_path, 'rb') as f:
                file_content = f.read()
            
            content_base64 = base64.b64encode(file_content).decode('utf-8')
            
            # 获取现有文件的SHA（如果存在）
            file_sha = self.get_file_sha(github_file_path)
            
            # 准备API请求
            github_config = self.config['github']
            url = f"https://api.github.com/repos/{github_config['owner']}/{github_config['repo']}/contents/{github_file_path}"
            
            headers = {
                'Authorization': f"token {github_config['token']}",
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
            }
            
            # 生成提交消息
            import datetime
            timestamp = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            commit_message = self.config['commit_message_template'].format(
                timestamp=timestamp,
                filename=os.path.basename(github_file_path)
            )
            
            # 构建请求数据
            data = {
                'message': commit_message,
                'content': content_base64,
                'branch': github_config['branch']
            }
            
            # 如果文件已存在，需要提供SHA
            if file_sha:
                data['sha'] = file_sha
                self.logger.info(f"更新文件: {github_file_path}")
            else:
                self.logger.info(f"创建文件: {github_file_path}")
            
            # 发送请求
            response = requests.put(url, headers=headers, json=data, timeout=self.config['api_timeout'])
            
            if response.status_code in [200, 201]:
                self.logger.info(f"文件上传成功: {github_file_path}")
                return True
            else:
                self.logger.error(f"文件上传失败: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            self.logger.error(f"上传文件 {local_file_path} 时发生错误: {e}")
            return False
    
    def upload_all_files(self) -> Dict[str, bool]:
        """上传所有配置的文件"""
        results = {}
        
        self.logger.info("开始上传文件到GitHub...")
        
        for file_config in self.config['files_to_upload']:
            local_path = file_config['local_path']
            github_path = file_config['github_path']
            
            self.logger.info(f"处理文件: {local_path} -> {github_path}")
            success = self.upload_file(local_path, github_path)
            results[local_path] = success
        
        # 统计结果
        success_count = sum(1 for success in results.values() if success)
        total_count = len(results)
        
        self.logger.info(f"上传完成: {success_count}/{total_count} 个文件成功")
        
        return results
    
    def run(self):
        """运行主程序"""
        self.logger.info("GitHub上传器启动")
        
        # 检查配置
        github_config = self.config.get('github', {})
        if not all([
            github_config.get('owner'),
            github_config.get('repo'), 
            github_config.get('token')
        ]):
            self.logger.error("GitHub配置不完整，请检查配置文件")
            return False
        
        # 上传文件
        results = self.upload_all_files()
        
        # 检查是否有失败的上传
        failed_files = [path for path, success in results.items() if not success]
        if failed_files:
            self.logger.warning(f"以下文件上传失败: {failed_files}")
            return False
        
        self.logger.info("所有文件上传成功")
        return True

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='GitHub文件上传器')
    parser.add_argument('--config', default='config/github_config.json', help='配置文件路径')
    
    args = parser.parse_args()
    
    uploader = GitHubUploader(args.config)
    success = uploader.run()
    
    exit(0 if success else 1)
