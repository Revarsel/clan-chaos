import { RoomClient } from "@/components/RoomClient";

export default function RoomPage({ params }: { params: { code: string } }) {
  return <RoomClient code={params.code.toUpperCase()} />;
}
