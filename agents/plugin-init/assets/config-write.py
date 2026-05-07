import json
from datetime import datetime

config_path = '.mrd-to-code-config.json'
try:
    config = json.load(open(config_path))
except:
    config = {}

# 嵌套对象结构
config['plugin_availability'] = {
    'ecc_runtime': {
        'installed': ${ecc_installed},
        'skills_dir': '${ecc_skills_dir}' if ${ecc_installed} else None,
        'version': 'unknown'
    },
    'ecc_rules': {
        'installed': ${ecc_rules_installed},
        'claude_md': '${ecc_rules_claude_md}' if ${ecc_rules_installed} else None
    },
    'hooks': {
        'installed': ${ecc_installed},
        'gitnexus_hook': '$HOME/.claude/hooks/gitnexus/gitnexus-hook.cjs' if ${ecc_installed} else None,
        'hooks_json': '$HOME/.claude/hooks/hooks.json' if ${ecc_installed} else None
    },
    'rtk': {
        'installed': ${rtk_installed},
        'config': 'RTK.md referenced in CLAUDE.md' if ${rtk_installed} else None
    },
    'gitnexus': {
        'installed': ${gn_cli_installed},
        'version': '${gn_version}' if ${gn_cli_installed} else None,
        'mcp_configured': ${gn_mcp_configured},
        'mcp_available': ${gn_mcp_configured} and ${gn_indexed},
        'knowledge_graph': {
            'nodes': ${gn_nodes},
            'edges': ${gn_edges},
            'indexed_at': datetime.now().isoformat(timespec='seconds') + '+08:00' if ${gn_indexed} else None
        } if ${gn_indexed} else None
    },
    'autoresearch': {
        'installed': ${ar_installed},
        'skills_dir': '${ar_skills_dir}' if ${ar_installed} else None
    },
    'pua': {
        'installed': ${pua_installed},
        'active': ${pua_installed},
        'flavor': '${pua_flavor}' if ${pua_installed} else None
    },
    'beads': {
        'installed': ${beads_installed},
        'version': '${beads_version}' if ${beads_installed} else None,
        'initialized': ${beads_initialized},
        'claude_integrated': ${beads_claude_integrated},
        'issue_count': ${beads_issue_count} if ${beads_initialized} else 0
    }
}

# 时间戳
now = datetime.now().isoformat(timespec='seconds').replace('+', '+08:00')
if 'created_at' not in config:
    config['created_at'] = now
config['last_updated'] = now

json.dump(config, open(config_path, 'w'), indent=2, ensure_ascii=False)
print('plugin-init: plugin_availability 已写入')
