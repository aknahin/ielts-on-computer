import { notFound } from "next/navigation";
import { SetupPage } from "@/components/setup/SetupPage";
import { SpeakingSetup } from "@/components/speaking/SpeakingSetup";
import { WritingSetup } from "@/components/writing/WritingSetup";
import {
  getTest,
  isScored,
  isSection,
  listTests,
  readSection,
  readTaskSection,
} from "@/lib/contents";

export async function generateStaticParams() {
  return (await listTests()).flatMap((t) =>
    t.sections.filter((s) => s.complete).map((s) => ({ test: t.slug, section: s.section })),
  );
}

export default async function LibrarySection({
  params,
}: {
  params: Promise<{ test: string; section: string }>;
}) {
  const { test: slug, section } = await params;
  if (!isSection(section)) notFound();

  const test = await getTest(slug);
  if (!test) notFound();

  if (isScored(section)) {
    const files = await readSection(slug, section);
    if (!files) notFound();
    return <SetupPage type={section} preset={{ testTitle: test.title, files }} />;
  }

  const file = await readTaskSection(slug, section);
  if (!file) notFound();
  return section === "writing" ? (
    <WritingSetup testTitle={test.title} file={file} />
  ) : (
    <SpeakingSetup testTitle={test.title} file={file} />
  );
}
