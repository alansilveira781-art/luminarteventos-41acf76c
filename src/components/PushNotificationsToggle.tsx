import { useEffect, useState } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  enablePush,
  disablePush,
  isPushSubscribed,
  pushSupported,
  pushAvailableHere,
} from "@/lib/push";

export function PushNotificationsToggle() {
  const { user } = useAuth();
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    setAvailable(pushAvailableHere());
    if (pushSupported()) {
      isPushSubscribed().then(setSubscribed).catch(() => {});
    }
  }, []);

  if (!pushSupported()) return null;

  const handle = async () => {
    if (!user) return;
    setLoading(true);
    try {
      if (subscribed) {
        await disablePush();
        setSubscribed(false);
        toast.success("Notificações desativadas neste dispositivo.");
      } else {
        await enablePush(user.id);
        setSubscribed(true);
        toast.success("Notificações ativadas neste dispositivo!");
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível alterar as notificações.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        size="sm"
        variant={subscribed ? "outline" : "default"}
        onClick={handle}
        disabled={loading || (!available && !subscribed)}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : subscribed ? (
          <BellOff className="h-4 w-4" />
        ) : (
          <Bell className="h-4 w-4" />
        )}
        <span className="ml-1.5">
          {subscribed ? "Desativar push" : "Ativar push neste celular"}
        </span>
      </Button>
      {!available && !subscribed && (
        <span className="text-[10px] text-muted-foreground max-w-[220px] text-right">
          Instale o app na tela inicial e abra por lá para ativar as notificações.
        </span>
      )}
    </div>
  );
}
