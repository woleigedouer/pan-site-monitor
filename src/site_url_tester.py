#!/usr/bin/env python3
import json
import requests
import os
import warnings
import re
from urllib3.exceptions import InsecureRequestWarning
from pathlib import Path

warnings.simplefilter('ignore', InsecureRequestWarning)

class SiteURLTester:
    def __init__(self, config_file: str = None):
        """初始化站点URL测试器"""
        # 获取项目根目录（脚本文件的上两级目录）
        self.base_dir = Path(__file__).parent.parent.absolute()

        # 设置默认配置文件路径
        if config_file is None:
            config_file = self.base_dir / "config" / "url_tester_config.json"
        else:
            config_file = Path(config_file)
            if not config_file.is_absolute():
                config_file = self.base_dir / config_file

        self.config_file = str(config_file)
        self.config = self.load_config()
        self.last_site = None

    def safe_print(self, text: str):
        """安全打印函数，处理编码问题"""
        try:
            print(text)
        except UnicodeEncodeError:
            # Windows环境下处理emoji编码问题
            safe_text = text.encode('ascii', 'ignore').decode('ascii')
            print(safe_text)
        
    def load_config(self) -> dict:
        """加载配置文件"""
        default_config = {
            # TVBox相关配置
            "tvbox_json_dir": str(self.base_dir / "files" / "TVBoxOSC" / "tvbox" / "json"),
            "tvbox_files_config": {
                "wogg.json": "玩偶",
                "mogg.json": "木偶",
                "lb.json": "蜡笔",
                "zz.json": "至臻",
                "yyds.json": "多多",
                "og.json": "欧哥",
                "ex.json": "二小",
                "hb.json": "虎斑",
                "sd.json": "闪电"
            },
            
            # URL测试配置
            "search_paths": {
                '闪电': '/index.php/vod/search.html?wd=仙台有树',
                '欧哥': '/index.php/vod/search.html?wd=仙台有树',
                '多多': '/index.php/vod/search.html?wd=仙台有树',
                '蜡笔': '/index.php/vod/search.html?wd=仙台有树',
                '至臻': '/index.php/vod/search.html?wd=仙台有树',
                '虎斑': '/index.php/vod/search.html?wd=仙台有树',
                '玩偶': '/vodsearch/-------------.html?wd=仙台有树',
                '木偶': '/index.php/vod/search.html?wd=仙台有树',
                '二小': '/index.php/vod/search.html?wd=仙台有树'
            },
            
            "keyword_validation": {
                '闪电': 'class="search-stat"',
                '欧哥': 'class="search-stat"',
                '多多': 'class="search-stat"',
                '蜡笔': 'class="search-stat"',
                '至臻': 'class="search-stat"',
                '虎斑': 'class="search-stat"',
                '玩偶': 'class="search-stat"',
                '木偶': 'class="search-stat"',
                '二小': 'class="search-stat"'
            },
            
            "url_weights": {
                "木偶": {"https://aliii.deno.dev": 60, "http://149.88.87.72:5666": 60},
                "至臻": {"http://www.xhww.net": 10, "http://xhww.net": 10}
            },
            
            # 代理配置
            "proxy": {
                "enabled": False,
                "proxies": {"http": "http://127.0.0.1:7890", "https": "http://127.0.0.1:7890"}
            },
            
            # 测试配置
            "test_timeout": 7,
            "default_weight": 50
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
                with open(self.config_file, 'w', encoding='utf-8') as f:
                    json.dump(default_config, f, ensure_ascii=False, indent=4)
        except Exception as e:
            self.safe_print(f"配置文件加载失败，使用默认配置: {e}")

        return default_config
    
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
                message = message.replace(status, f"{status} {emoji}")
                break
        else:
            message += " 📢"

        self.safe_print(f"[{step}] {message}" if step else message)
    
    def extract_urls_from_tvbox(self) -> dict:
        """从TVBox JSON文件或data/test.json中提取URL信息"""
        self.log_message("[开始] 提取URL信息...", step="提取URL")

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
        tvbox_dir = self.config['tvbox_json_dir']

        if not os.path.exists(tvbox_dir):
            self.log_message(f"[错误] TVBox目录不存在: {tvbox_dir}，且data/test.json也不可用", step="提取URL")
            return {}

        self.log_message(f"[信息] 从TVBox目录读取: {tvbox_dir}", step="提取URL")

        for filename, site_name in self.config['tvbox_files_config'].items():
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
        search_path = self.config['search_paths'].get(site_name)
        test_url_str = f"{url.strip()}{search_path}" if search_path else url.strip()
        keyword = self.config['keyword_validation'].get(site_name)

        try:
            response = requests.get(test_url_str, timeout=self.config['test_timeout'], verify=False)
            latency = response.elapsed.total_seconds()

            if response.status_code == 200:
                has_keyword = keyword in response.text if keyword else True
                if has_keyword:
                    self.log_message(f"[成功] URL {test_url_str} 延迟: {latency:.2f}s{'，包含关键字 ' + keyword if keyword else ''}",
                                    site_name, "测试URL")
                else:
                    self.log_message(f"[成功] URL {test_url_str} 延迟: {latency:.2f}s，但不包含关键字 '{keyword}'",
                                    site_name, "测试URL")
                    self.log_message(f"[警告] 该URL返回200但无关键字，可能存在Cloudflare盾或其他反爬机制",
                                    site_name, "测试URL")
                return latency, has_keyword
            else:
                self.log_message(f"[失败] URL {test_url_str} 返回HTTP错误: 状态码 {response.status_code}",
                                site_name, "测试URL")
                return None, None

        except requests.RequestException as e:
            error_type = "[超时]" if isinstance(e, requests.Timeout) else "[连接失败]" if isinstance(e, requests.ConnectionError) else "[错误]"
            self.log_message(f"{error_type} URL {test_url_str} {str(e)}", site_name, "测试URL")

            # 尝试代理访问
            if self.config['proxy'].get("enabled", False):
                try:
                    response = requests.get(test_url_str, timeout=self.config['test_timeout'],
                                          verify=False, proxies=self.config['proxy']['proxies'])
                    latency = response.elapsed.total_seconds()

                    if response.status_code == 200:
                        has_keyword = keyword in response.text if keyword else True
                        if has_keyword:
                            self.log_message(f"[成功] URL {test_url_str} 通过代理访问成功，延迟: {latency:.2f}s{'，包含关键字 ' + keyword if keyword else ''}",
                                            site_name, "测试URL")
                        else:
                            self.log_message(f"[成功] URL {test_url_str} 通过代理访问成功，延迟: {latency:.2f}s，但不包含关键字 '{keyword}'",
                                            site_name, "测试URL")
                        self.log_message(f"[信息] 非代理访问失败但代理访问成功，建议配置代理",
                                        site_name, "测试URL")
                        return latency, has_keyword
                    else:
                        self.log_message(f"[失败] URL {test_url_str} 通过代理访问返回HTTP错误: 状态码 {response.status_code}",
                                        site_name, "测试URL")
                        return None, None

                except requests.RequestException as proxy_e:
                    proxy_error_type = "[超时]" if isinstance(proxy_e, requests.Timeout) else "[连接失败]" if isinstance(proxy_e, requests.ConnectionError) else "[错误]"
                    self.log_message(f"{proxy_error_type} URL {test_url_str} 代理访问也失败: {str(proxy_e)}",
                                    site_name, "测试URL")

            return None, None

    def select_best_url(self, urls, site_name=None):
        """选择最佳URL"""
        if not isinstance(urls, list):
            return urls

        if len(urls) == 1:
            self.log_message(f"[信息] 站点仅有单一URL {urls[0]}，直接使用", site_name, "选择最佳URL")
            return urls[0]

        weights = self.config['url_weights'].get(site_name, {})
        default_weight = self.config['default_weight']
        url_data = [(url, weights.get(url, default_weight)) for url in urls]
        sorted_urls = sorted(url_data, key=lambda x: -x[1])

        url_results = {}
        highest_weight = sorted_urls[0][1] if sorted_urls else 0
        has_keyword_at_highest_weight = False

        for url, weight in sorted_urls:
            if has_keyword_at_highest_weight and weight < highest_weight:
                self.log_message(f"[信息] 最高权重 {highest_weight} 已找到包含关键字的URL，跳过低权重URL {url} (权重: {weight}) 测试",
                                site_name, "选择最佳URL")
                continue

            latency, has_keyword = self.test_url_availability(url, site_name)
            if latency is not None:
                url_results[url] = (latency, has_keyword, weight)
                if has_keyword and weight == highest_weight:
                    has_keyword_at_highest_weight = True

        if not url_results:
            self.log_message(f"[警告] 当前无可用URL", site_name, "选择最佳URL")
            return None

        # 排序：关键字 > 权重 > 延迟
        sorted_results = sorted(url_results.items(), key=lambda x: (-x[1][1], -x[1][2], x[1][0]))

        best_url, (best_latency, best_has_keyword, best_weight) = sorted_results[0]
        self.log_message(f"[选择] 最优URL: {best_url} (关键字: {best_has_keyword}, 权重: {best_weight}, 延迟: {best_latency:.2f}s)",
                        site_name, "选择最佳URL")

        return best_url, url_results

    def save_results_to_json(self, results, output_file=None):
        """保存测试结果到JSON文件"""
        try:
            # 设置默认输出文件路径
            if output_file is None:
                output_file = str(self.base_dir / "data" / "test_results.json")

            # 确保输出目录存在
            output_dir = os.path.dirname(output_file)
            if output_dir:
                os.makedirs(output_dir, exist_ok=True)
            # 准备JSON数据
            json_data = {
                "timestamp": __import__('datetime').datetime.now().isoformat(),
                "summary": {
                    "total_sites": len(results),
                    "success_sites": len([r for r in results.values() if r['best_url']]),
                    "failed_sites": len([r for r in results.values() if not r['best_url']])
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
                    for url, (latency, has_keyword, weight) in result['url_results'].items():
                        url_data = {
                            "url": url,
                            "latency": round(latency, 2),
                            "has_keyword": has_keyword,
                            "weight": weight,
                            "is_best": url == result['best_url']
                        }
                        site_data['urls'].append(url_data)

                    # 按是否为最佳URL排序，最佳的在前面
                    site_data['urls'].sort(key=lambda x: (not x['is_best'], x['latency']))

                json_data['sites'][site_name] = site_data

            # 保存到文件
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(json_data, f, ensure_ascii=False, indent=2)

            self.log_message(f"[成功] 测试结果已保存到 {output_file}", step="保存结果")
            return True

        except Exception as e:
            self.log_message(f"[错误] 保存JSON结果失败: {e}", step="保存结果")
            return False

    def print_test_results(self, results):
        """打印测试结果"""
        self.log_message("[开始] 生成测试报告...", step="结果报告")

        total_sites = len(results)
        success_sites = []
        failed_sites = []

        self.safe_print(f"\n{'🎯 ' + '='*50 + ' 🎯'}")
        self.safe_print(f"📊 测试结果汇总")
        self.safe_print(f"{'🎯 ' + '='*50 + ' 🎯'}")

        for site_name, result in results.items():
            if result['best_url']:
                success_sites.append(site_name)
                self.safe_print(f"\n✅ {site_name}:")
                self.safe_print(f"   🔗 最优URL: {result['best_url']}")
                if 'url_results' in result and result['url_results']:
                    self.safe_print(f"   📈 测试详情:")
                    for url, (latency, has_keyword, weight) in result['url_results'].items():
                        status = "✅" if url == result['best_url'] else "⚪"
                        keyword_status = "🔑" if has_keyword else "❌"
                        self.safe_print(f"      {status} {url}")
                        self.safe_print(f"         延迟: {latency:.2f}s | 权重: {weight} | 关键字: {keyword_status}")
            else:
                failed_sites.append(site_name)
                self.safe_print(f"\n❌ {site_name}: 无可用URL")

        self.safe_print(f"\n{'📈 ' + '='*50 + ' 📈'}")
        self.safe_print(f"📊 统计信息:")
        self.safe_print(f"   🎯 总站点数: {total_sites}")
        self.safe_print(f"   ✅ 成功站点: {len(success_sites)} ({len(success_sites)/total_sites*100:.1f}%)")
        self.safe_print(f"   ❌ 失败站点: {len(failed_sites)} ({len(failed_sites)/total_sites*100:.1f}%)")

        if success_sites:
            self.safe_print(f"   🎉 成功站点列表: {', '.join(success_sites)}")
        if failed_sites:
            self.safe_print(f"   ⚠️  失败站点列表: {', '.join(failed_sites)}")

        self.safe_print(f"{'📈 ' + '='*50 + ' 📈'}")

        self.log_message("[完成] 测试报告生成完毕", step="结果报告")

    def run(self):
        """运行主程序"""
        self.log_message("[开始] 站点URL测试器启动...", step="主程序")

        # 1. 提取URL
        extracted_urls = self.extract_urls_from_tvbox()
        if not extracted_urls:
            self.log_message("[错误] 未提取到任何URL，程序退出", step="主程序")
            return

        # 2. 测试URL并选择最优
        results = {}
        for site_name, urls in extracted_urls.items():
            self.log_message(f"[开始] 开始测试站点: {site_name}", site_name, "站点测试")

            if len(urls) == 1:
                # 单个URL直接测试
                latency, has_keyword = self.test_url_availability(urls[0], site_name)
                if latency is not None:
                    results[site_name] = {
                        'best_url': urls[0],
                        'url_results': {urls[0]: (latency, has_keyword, self.config['default_weight'])}
                    }
                else:
                    results[site_name] = {'best_url': None}
            else:
                # 多个URL选择最优
                best_result = self.select_best_url(urls, site_name)
                if best_result and len(best_result) == 2:
                    best_url, url_results = best_result
                    results[site_name] = {
                        'best_url': best_url,
                        'url_results': url_results
                    }
                else:
                    results[site_name] = {'best_url': None}

        # 3. 保存JSON结果和打印结果
        self.save_results_to_json(results)
        self.print_test_results(results)

        self.log_message("[完成] 站点URL测试完成", step="主程序")
        return results

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description='站点URL测试器')
    parser.add_argument('--config', default='config/url_tester_config.json', help='配置文件路径')

    args = parser.parse_args()

    tester = SiteURLTester(args.config)
    tester.run()
