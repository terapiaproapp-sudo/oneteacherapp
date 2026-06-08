import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Send, Loader2 } from "lucide-react";

export function WebhookTestDialog() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    plan: "mensal",
    apiKey: "",
  });

  const handleTest = async () => {
    if (!formData.email || !formData.apiKey) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha o email e a API Key da Newexy.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const webhookUrl = "https://vazqhruppvzaytenqdtt.supabase.co/functions/v1/newexy-webhook";
      
      const getNextBilling = (plan: string) => {
        const date = new Date();
        if (plan === "teste") date.setDate(date.getDate() + 7);
        else if (plan === "mensal") date.setMonth(date.getMonth() + 1);
        else if (plan === "semestral") date.setMonth(date.getMonth() + 6);
        else if (plan === "anual") date.setFullYear(date.getFullYear() + 1);
        return date.toISOString().split('T')[0];
      };

      const payload = {
        event: "payment.approved",
        email: formData.email,
        plan: formData.plan,
        next_billing: getNextBilling(formData.plan),
        api_key: formData.apiKey,
      };


      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (response.ok) {
        toast({
          title: "Sucesso!",
          description: `Plano ${formData.plan} liberado para ${formData.email}.`,
        });
      } else {
        throw new Error(result.error || "Falha no webhook");
      }
    } catch (error: any) {
      toast({
        title: "Erro no teste",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Send className="h-4 w-4" />
          Testar Webhook Newexy
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Simular Pagamento Newexy</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email do Professor</Label>
            <Input 
              id="email" 
              placeholder="exemplo@email.com" 
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="plan">Plano</Label>
            <Select 
              value={formData.plan} 
              onValueChange={(v) => setFormData({ ...formData, plan: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o plano" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="teste">Teste (7 dias)</SelectItem>
                <SelectItem value="mensal">Mensal</SelectItem>
                <SelectItem value="semestral">Semestral</SelectItem>
                <SelectItem value="anual">Anual</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="apiKey">NEWEXY_API_KEY</Label>
            <Input 
              id="apiKey" 
              type="password"
              placeholder="Cole a chave configurada no Supabase" 
              value={formData.apiKey}
              onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
            />
            <p className="text-[10px] text-muted-foreground">
              A chave deve ser exatamente a mesma salva no Segredos (secrets) do Supabase.
            </p>
          </div>
          <Button 
            className="w-full gap-2" 
            onClick={handleTest} 
            disabled={loading}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Enviar Payload de Teste
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
