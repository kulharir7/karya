import { execSync } from "child_process";

export async function GET() {
  try {
    const output = execSync(
      'powershell -Command "Get-PSDrive -PSProvider FileSystem | Select-Object Name,@{N=\'UsedGB\';E={[math]::Round($_.Used/1GB,1)}},@{N=\'FreeGB\';E={[math]::Round($_.Free/1GB,1)}} | ConvertTo-Json"',
      { encoding: "utf-8", timeout: 5000 }
    );
    const data = JSON.parse(output);
    const drives = (Array.isArray(data) ? data : [data]).filter((d: any) => d.UsedGB > 0 || d.FreeGB > 0);

    return Response.json({
      disks: drives.map((d: any) => ({
        drive: d.Name + ":",
        total: (d.UsedGB + d.FreeGB).toFixed(1) + " GB",
        free: d.FreeGB.toFixed(1) + " GB",
        used: d.UsedGB.toFixed(1) + " GB",
        percent: Math.round((d.UsedGB / (d.UsedGB + d.FreeGB)) * 100) || 0,
      })),
    });
  } catch {
    return Response.json({ disks: [] });
  }
}
