import { execSync } from "child_process";

export async function GET() {
  try {
    const output = execSync(
      'powershell -Command "Get-Process | Sort-Object WorkingSet64 -Descending | Select-Object -First 15 Name,Id,@{N=\'MemMB\';E={[math]::Round($_.WorkingSet64/1MB,1)}} | ConvertTo-Json"',
      { encoding: "utf-8", timeout: 5000 }
    );
    const data = JSON.parse(output);
    const list = Array.isArray(data) ? data : [data];

    return Response.json({
      processes: list.map((p: any) => ({
        name: p.Name,
        pid: p.Id,
        memoryMB: p.MemMB,
      })),
    });
  } catch {
    return Response.json({ processes: [] });
  }
}
