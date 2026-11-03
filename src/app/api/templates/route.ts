import catalog from "@/lib/templates.json";

export function GET() {
  return Response.json(catalog);
}
