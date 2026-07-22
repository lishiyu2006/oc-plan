#!/usr/bin/env node
/**
 * content/ 目录自动同步脚本(无第三方依赖)
 *
 * 每隔 N 分钟检查 content/ 是否有未提交变更,有则:
 *   git add content/ && git commit -m "content: auto sync <时间>" && git push
 *
 * 用法:
 *   node scripts/sync.mjs                # 默认每 10 分钟
 *   node scripts/sync.mjs --interval 5   # 每 5 分钟
 *   SYNC_INTERVAL=15 node scripts/sync.mjs
 * 停止: Ctrl + C
 */
import { execSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function argValue(name) {
  const i = process.argv.indexOf(name)
  return i !== -1 ? process.argv[i + 1] : null
}

const intervalMin = Number(argValue('--interval') || process.env.SYNC_INTERVAL || 10)
if (!Number.isFinite(intervalMin) || intervalMin <= 0) {
  console.error('--interval 必须是正数(分钟)')
  process.exit(1)
}
const intervalMs = intervalMin * 60 * 1000

function log(...args) {
  console.log(`[${new Date().toLocaleString()}]`, ...args)
}

function run(cmd) {
  return execSync(cmd, {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
  }).trim()
}

function syncOnce() {
  try {
    try {
      run('git rev-parse --is-inside-work-tree')
    } catch {
      log('当前目录不是 git 仓库,请先 git init 并提交一次。跳过本次检查。')
      return
    }

    let remotes = ''
    try {
      remotes = run('git remote')
    } catch {
      remotes = ''
    }

    const status = run('git status --porcelain -- content/')
    if (!status) {
      log('content/ 无变更,无需同步。')
      return
    }

    log('检测到 content/ 变更:')
    console.log(status)

    run('git add content/')
    const msg = `content: auto sync ${new Date().toISOString()}`
    run(`git commit -m "${msg}"`)
    log('已本地提交:', msg)

    if (!remotes) {
      log('未配置远程仓库(git remote 为空),跳过 push。配置后可自动推送。')
      return
    }

    try {
      run('git push')
      log('push 成功。')
    } catch (e1) {
      // 可能是未设置上游分支,尝试 push -u origin HEAD
      try {
        run('git push -u origin HEAD')
        log('push 成功(已设置上游分支)。')
      } catch (e2) {
        log('push 失败(网络或权限问题,下个周期会自动重试):', e2.message.split('\n')[0])
      }
    }
  } catch (e) {
    log('同步过程出错:', e.message.split('\n')[0])
  }
}

log(`启动 content/ 自动同步,每 ${intervalMin} 分钟检查一次。按 Ctrl + C 退出。`)
syncOnce()
setInterval(syncOnce, intervalMs)
