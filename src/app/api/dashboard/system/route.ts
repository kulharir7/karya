import * as os from "os";

export async function GET() {
  return Response.json({
    os: `${os.type()} ${os.release()}`,
    platform: os.platform(),
    hostname: os.hostname(),
    username: os.userInfo().username,
    cpus: os.cpus().length,
    totalMemoryGB: Math.round((os.totalmem() / 1073741824) * 10) / 10,
    freeMemoryGB: Math.round((os.freemem() / 1073741824) * 10) / 10,
    homeDir: os.homedir(),
    cwd: process.cwd(),
    uptime: Math.round(os.uptime() / 3600),
    arch: os.arch(),
  });
}
