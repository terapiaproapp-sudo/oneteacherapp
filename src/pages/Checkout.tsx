import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, CreditCard, Lock, Smartphone } from "lucide-react";
import { toast } from "sonner";
import logo from "@/assets/logo-oneteacher.png";
import Seo from "@/components/Seo";

export default function Checkout() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const productId = searchParams.get("product");
  const planId = searchParams.get("plan");
  const redirectUrl = searchParams.get("redirect");

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    cpf: "",
  });

  const [loading, setLoading] = useState(false);

  // Mock product data based on Planos.tsx
  const products = {
    mensal: { name: "Plano Mensal", price: "R$ 39,90", period: "mês" },
    semestral: { name: "Plano Semestral", price: "R$ 197,00", period: "6 meses" },
    anual: { name: "Plano Anual", price: "R$ 347,00", period: "ano" },
  };

  const selectedPlan = planId && products[planId as keyof typeof products] 
    ? products[planId as keyof typeof products] 
    : products.mensal;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.cpf) {
      toast.error("Por favor, preencha todos os campos.");
      return;
    }

    setLoading(true);
    
    // Simulate payment processing
    setTimeout(() => {
      setLoading(false);
      toast.success("Pagamento processado com sucesso!");
      
      if (redirectUrl) {
        window.location.href = redirectUrl;
      } else {
        navigate("/login");
      }
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center py-12 px-4">
      <div className="mb-8">
        <img src={logo} alt="OneTeacher" className="h-12 object-contain" />
      </div>

      <div className="max-w-4xl w-full grid md:grid-cols-5 gap-8">
        <div className="md:col-span-3 space-y-6">
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-xl">Informações de Contato</CardTitle>
              <CardDescription>Preencha seus dados para prosseguir com o pagamento.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome Completo</Label>
                <Input 
                  id="name" 
                  name="name" 
                  placeholder="Seu nome" 
                  value={formData.name} 
                  onChange={handleInputChange} 
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input 
                  id="email" 
                  name="email" 
                  type="email" 
                  placeholder="seu@email.com" 
                  value={formData.email} 
                  onChange={handleInputChange} 
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cpf">CPF</Label>
                <Input 
                  id="cpf" 
                  name="cpf" 
                  placeholder="000.000.000-00" 
                  value={formData.cpf} 
                  onChange={handleInputChange} 
                  required
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-xl">Forma de Pagamento</CardTitle>
              <CardDescription>Escolha como deseja pagar.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="border-2 border-primary rounded-xl p-4 flex flex-col items-center gap-2 cursor-pointer bg-primary/5">
                  <CreditCard className="h-6 w-6 text-primary" />
                  <span className="text-sm font-medium">Cartão de Crédito</span>
                </div>
                <div className="border border-slate-200 rounded-xl p-4 flex flex-col items-center gap-2 cursor-pointer hover:border-slate-300">
                  <Smartphone className="h-6 w-6 text-slate-400" />
                  <span className="text-sm font-medium text-slate-600">PIX</span>
                </div>
              </div>

              <div className="mt-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="cardNumber">Número do Cartão</Label>
                  <Input id="cardNumber" placeholder="0000 0000 0000 0000" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="expiry">Validade</Label>
                    <Input id="expiry" placeholder="MM/AA" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cvv">CVV</Label>
                    <Input id="cvv" placeholder="123" />
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-4">
              <Button 
                className="w-full h-12 text-lg font-bold" 
                onClick={handleSubmit}
                disabled={loading}
              >
                {loading ? "Processando..." : `Pagar ${selectedPlan.price}`}
              </Button>
              <div className="flex items-center gap-2 text-xs text-muted-foreground justify-center">
                <Lock className="h-3 w-3" />
                Pagamento seguro e criptografado
              </div>
            </CardFooter>
          </Card>
        </div>

        <div className="md:col-span-2">
          <Card className="border-none shadow-sm sticky top-8">
            <CardHeader>
              <CardTitle className="text-lg">Resumo do Pedido</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-bold">{selectedPlan.name}</h4>
                  <p className="text-sm text-muted-foreground">Assinatura recorrente</p>
                </div>
                <span className="font-bold">{selectedPlan.price}</span>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Acesso ilimitado aos recursos</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Suporte prioritário</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Cancelamento a qualquer momento</span>
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="flex justify-between items-center text-xl font-extrabold">
                  <span>Total</span>
                  <span>{selectedPlan.price}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Cobrado a cada {selectedPlan.period}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}