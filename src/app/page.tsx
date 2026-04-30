import { PropertyWorkbench } from "@/components/property-workbench";
import { listPropertyDrafts } from "@/offchain/repository";

export const dynamic = "force-dynamic";

export default async function Home() {
  const drafts = await listPropertyDrafts();

  return <PropertyWorkbench initialProperties={drafts} />;
}
