import type { Metadata } from "next";
import { fetchCourse } from "@/lib/api";
import { formatDisplayTitle } from "@/lib/courseTitles";

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const { id } = await params;
    const course = await fetchCourse(id);
    
    if (!course) {
      return {
        title: "Course Not Found",
      };
    }

    return {
      title: formatDisplayTitle(course.title),
      description: course.description || `Learn ${formatDisplayTitle(course.title)} on StreamApp.`,
      openGraph: {
        title: formatDisplayTitle(course.title),
        description: course.description || `Learn ${formatDisplayTitle(course.title)} on StreamApp.`,
      },
    };
  } catch (error) {
    return {
      title: "Course Details",
    };
  }
}

export default function CourseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
