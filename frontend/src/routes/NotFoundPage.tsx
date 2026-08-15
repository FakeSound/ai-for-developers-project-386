import { Link } from "react-router";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";

export function NotFoundPage() {
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyTitle>Страница не найдена</EmptyTitle>
        <EmptyDescription>
          Проверьте адрес или вернитесь к списку видов встреч.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button asChild>
          <Link to="/">К видам встреч</Link>
        </Button>
      </EmptyContent>
    </Empty>
  );
}
