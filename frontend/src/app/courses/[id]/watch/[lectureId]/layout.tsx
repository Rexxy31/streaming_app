import type { Metadata } from "next";
import { fetchCourse } from "@/lib/api";
import { formatDisplayTitle } from "@/lib/courseTitles";

type Props = {
  params: Promise<{ id: string; lectureId: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const { id, lectureId } = await params;
    const course = await fetchCourse(id);
    
    if (!course) {
      return {
        title: "Lecture Not Found",
      };
    }

    // Find the specific lecture
    let lectureInfo = null;
    let sectionIdx = 1;
    let lectureIdx = 1;

    for (const section of course.sections || []) {
      for (const lecture of section.lectures) {
        if (lecture.id === lectureId) {
          lectureInfo = { ...lecture, number: `${sectionIdx}.${lectureIdx}` };
          break;
        }
        lectureIdx++;
      }
      sectionIdx++;
      lectureIdx = 1;
    }

    if (!lectureInfo) {
      return {
        title: `Playing - ${formatDisplayTitle(course.title)}`,
      };
    }

    const courseTitle = formatDisplayTitle(course.title);
    const lectureTitle = lectureInfo.title;

    return {
      title: `${lectureInfo.number} ${lectureTitle}`,
      description: `Watch ${lectureTitle} from ${courseTitle} on StreamApp.`,
      openGraph: {
        title: `${lectureTitle} | ${courseTitle}`,
        description: `Stream ${lectureTitle} and more premium content from ${courseTitle}.`,
        images: [
          {
             url: "/logo.png", // In a real app we would use an API route to generate an OG image with the title
             width: 512,
             height: 512,
             alt: "Lecture Video Preview",
          }
        ]
      },
      twitter: {
        card: "summary_large_image",
        title: `${lectureTitle} | StreamApp`,
        description: `Stream ${lectureTitle} from ${courseTitle}.`
      }
    };
  } catch (error) {
    return {
      title: "Watch Course",
    };
  }
}

export default function WatchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
