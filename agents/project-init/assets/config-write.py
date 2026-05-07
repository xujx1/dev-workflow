import json
import os
from datetime import datetime

config_path = '.mrd-to-code-config.json'
try:
    config = json.load(open(config_path))
except:
    config = {}

# 嵌套对象结构
config['env'] = {
    'repo_path': os.getcwd(),
    'java': {
        'detected': True,
        'version': '${java_version}',
        'vendor': '${java_vendor}',
        'java_home': '${java_home}'
    },
    'maven': {
        'detected': True,
        'version': '${maven_version}',
        'maven_home': '${maven_home}'
    },
    'project': {
        'groupId': '${project_groupId}',
        'artifactId': '${project_artifactId}',
        'modules': '${project_modules}'.split(',') if '${project_modules}' else []
    }
}
config['test_runtime'] = {
    'mode': 'mock-first',
    'frameworks': ['junit', 'spring-boot-starter-test', 'mockito'],
    'test_dirs': '${test_dirs}'.split(',') if '${test_dirs}' else []
}
# openspec — 强制写入完整结构（核心参数，不可遗漏）
config['openspec'] = {
    'enabled': True,
    'threshold_person_days': 5,
    'generate_stage': 'before_code_gen',
    'archive_in_stage4': True
}

# 时间戳
now = datetime.now().isoformat(timespec='seconds').replace('+', '+08:00')
if 'created_at' not in config:
    config['created_at'] = now
config['last_updated'] = now

json.dump(config, open(config_path, 'w'), indent=2, ensure_ascii=False)
print('project-init: .mrd-to-code-config.json 已写入')

# Step 5 — 更新 .gitignore
try:
    existing = open('.gitignore').read()
except:
    existing = ''
if '/.mrd-to-code-config.json' not in existing:
    open('.gitignore', 'a').write('\n# dev-workflow 个人环境配置\n/.mrd-to-code-config.json\n')
    print('.gitignore 已追加 /.mrd-to-code-config.json')
else:
    print('.gitignore 无需更新')
