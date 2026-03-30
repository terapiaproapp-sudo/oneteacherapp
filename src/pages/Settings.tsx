import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Settings as SettingsIcon, LogOut } from "lucide-react";

export default function SettingsPage() {
  const { user, signOut } = useAuth();

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <h1 className="text-2xl font-bold">Configurações</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Minha Conta</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">Nome</p>
            <p className="font-medium">{user?.user_metadata?.full_name || "—"}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">E-mail</p>
            <p className="font-medium">{user?.email || "—"}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <Button variant="destructive" onClick={signOut}>
            <LogOut className="h-4 w-4 mr-2" /> Sair da conta
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
