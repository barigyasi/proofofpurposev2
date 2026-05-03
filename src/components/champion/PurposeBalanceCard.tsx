import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPurpose, usePurposeBalance } from "@/hooks/usePurposeBalance";

interface Props {
  address: string;
  onShowQR: () => void;
}

export function PurposeBalanceCard({ address, onShowQR }: Props) {
  const { data, isLoading } = usePurposeBalance(address);

  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 py-8">
        <p className="text-sm text-muted-foreground">Your $PURPOSE Balance</p>
        {isLoading ? (
          <Skeleton className="h-10 w-32" />
        ) : (
          <p className="text-4xl font-bold text-primary">{formatPurpose(data)}</p>
        )}
        <Button variant="secondary" onClick={onShowQR}>
          Show Redeem QR
        </Button>
      </CardContent>
    </Card>
  );
}
