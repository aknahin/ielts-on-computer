import { notFound } from "next/navigation";
import { SetupPage } from "@/components/setup/SetupPage";
import { getTest, isPlayable, listTests, readSection } from "@/lib/contents";

export async function generateStaticParams() {
  return (await listTests()).flatMap((t) =>
    t.sections
      .filter((s) => s.playable && s.complete)
      .map((s) => ({ test: t.slug, section: s.section })),
  );
}

export default async function LibrarySection({
  params,
}: {
  params: Promise<{ test: string; section: string }>;
}) {
  const { test: slug, section } = await params;
  if (!isPlayable(section)) notFound();

  const [test, files] = await Promise.all([getTest(slug), readSection(slug, section)]);
  if (!test || !files) notFound();

  return <SetupPage type={section} preset={{ testTitle: test.title, files }} />;
}
