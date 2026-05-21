import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useNavigate, Link } from "react-router-dom";
import {
  Users, CalendarDays, DollarSign, Clock, Zap, Percent, Check,
  ChevronRight, Shield, Smartphone, ArrowRight, Star, BarChart3, Package
} from "lucide-react";
import logo from "@/assets/logo-oneteacher.png";

const fadeUp = { hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0, transition: { duration: 0.6 } } };
const stagger = { visible: { transition: { staggerChildren: 0.12 } } };

const features = [
  { icon: Users, title: "Gestão completa de alunos", desc: "Cadastro com pacote, financeiro e saldo de horas integrados." },
  { icon: Clock, title: "Controle automático de horas", desc: "Abatimento inteligente conforme status da aula." },
  { icon: CalendarDays, title: "Agenda inteligente", desc: "Calendário mensal com detalhes e ações por aula." },
  { icon: BarChart3, title: "Financeiro com previsão mensal", desc: "Projeção de receita, parcelas e status de pagamento." },
  { icon: Package, title: "Parcelamento automático", desc: "Parcelas geradas e distribuídas nos meses certos." },
  { icon: Percent, title: "Desconto à vista", desc: "Cálculo automático com percentual configurável." },
];

const plans = [
  { name: "Teste", price: "Grátis", period: "10 dias", desc: "Acesso completo", highlight: false, features: ["Todos os recursos", "10 dias grátis", "Sem cartão de crédito"] },
  { name: "Mensal", price: "R$ 19,90", period: "/mês", desc: "Para quem quer começar", highlight: false, features: ["Alunos ilimitados", "Agenda completa", "Financeiro integrado", "Suporte por e-mail"] },
  { name: "Semestral", price: "R$ 99,90", period: "/6 meses", desc: "Economia de 16%", highlight: false, features: ["Tudo do Mensal", "R$ 16,65/mês", "Prioridade no suporte"] },
  { name: "Anual", price: "R$ 179,90", period: "/ano", desc: "Melhor custo-benefício", highlight: true, features: ["Tudo do Semestral", "R$ 14,99/mês", "Economia de 25%", "Suporte prioritário"] },
];

const faqs = [
  { q: "Funciona no celular?", a: "Sim! O OneTeacher é otimizado para mobile, funciona direto no navegador do seu celular como um app." },
  { q: "Preciso instalar algo?", a: "Não. Basta acessar pelo navegador. Sem downloads, sem instalações." },
  { q: "Posso cancelar quando quiser?", a: "Sim, sem multa, sem burocracia. Cancele a qualquer momento." },
  { q: "Serve para qualquer tipo de aula?", a: "Sim! Funciona para aulas de idiomas, música, reforço escolar, preparatório e qualquer disciplina." },
  { q: "Meus dados estão seguros?", a: "Totalmente. Usamos criptografia de ponta e servidores seguros para proteger suas informações." },
];

export default function Landing() {
  const [signupOpen, setSignupOpen] = useState(false);
  const navigate = useNavigate();
  const [signupForm, setSignupForm] = useState({ name: "", email: "", password: "" });

  const handleSignup = () => {
    navigate("/signup");
    setSignupOpen(false);
  };

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-20 sm:h-24 flex items-center justify-between">
          <img src={logo} alt="OneTeacher" className="h-12 sm:h-16 lg:h-20 object-contain" />
          <div className="flex items-center gap-2 sm:gap-3">
            <Button variant="ghost" size="sm" className="rounded-xl text-sm" onClick={() => navigate("/login")}>Entrar</Button>
            <Button size="sm" className="rounded-xl text-sm shadow-lg shadow-primary/20" onClick={() => setSignupOpen(true)}>Começar grátis</Button>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="pt-32 sm:pt-44 pb-16 sm:pb-24 px-4 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.03] via-transparent to-transparent" />
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-primary/[0.04] rounded-full blur-3xl" />
        <motion.div className="max-w-3xl mx-auto text-center relative" initial="hidden" animate="visible" variants={stagger}>
          <motion.div variants={fadeUp} className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/8 border border-primary/15 text-xs font-semibold text-primary mb-6">
            <Zap className="h-3.5 w-3.5" /> Feito para professores particulares
          </motion.div>
          <motion.h1 variants={fadeUp} className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1] mb-5">
            Pare de perder o controle{" "}
            <span className="text-primary">das suas aulas.</span>
          </motion.h1>
          <motion.p variants={fadeUp} className="text-base sm:text-xl text-primary font-semibold mb-2">
            Comece a ter previsibilidade no seu faturamento.
          </motion.p>
          <motion.p variants={fadeUp} className="text-sm sm:text-lg text-muted-foreground max-w-xl mx-auto mb-8 leading-relaxed">
            Organize alunos, pacotes, agenda e pagamentos em um único sistema simples, inteligente e feito para professores particulares.
          </motion.p>
          <motion.div variants={fadeUp} className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button size="lg" className="rounded-2xl h-12 px-8 text-base font-semibold shadow-xl shadow-primary/25 w-full sm:w-auto" onClick={() => setSignupOpen(true)}>
              Começar teste grátis <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
            <Button variant="outline" size="lg" className="rounded-2xl h-12 px-8 text-base w-full sm:w-auto" onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}>
              Ver como funciona
            </Button>
          </motion.div>
        </motion.div>
        {/* Mockup */}
        <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.8 }} className="max-w-4xl mx-auto mt-12 sm:mt-16 relative">
          <div className="absolute -inset-4 bg-gradient-to-t from-primary/10 via-primary/5 to-transparent rounded-3xl blur-2xl" />
          <div className="relative rounded-2xl sm:rounded-3xl border border-border/60 bg-card shadow-2xl shadow-primary/10 overflow-hidden p-4 sm:p-8">
            <div className="grid grid-cols-3 gap-3 sm:gap-4">
              {[
                { label: "Alunos Ativos", value: "24", color: "text-primary" },
                { label: "Horas Restantes", value: "87h", color: "text-accent" },
                { label: "A Receber", value: "R$ 4.580", color: "text-warning" },
              ].map((s, i) => (
                <div key={i} className="rounded-xl bg-muted/40 p-3 sm:p-4 text-center">
                  <p className={`text-lg sm:text-2xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 sm:mt-6 space-y-2">
              {["Maria — Inglês — 10h — 60%", "João — Matemática — 5h — 40%", "Ana — Piano — 20h — 15%"].map((item, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/30">
                  <span className="text-xs sm:text-sm text-muted-foreground">{item}</span>
                  <div className="w-16 sm:w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${[60, 40, 15][i]}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </section>

      {/* PAIN */}
      <section className="py-16 sm:py-24 px-4 bg-muted/30">
        <motion.div className="max-w-2xl mx-auto text-center" initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.3 }} variants={stagger}>
          <motion.h2 variants={fadeUp} className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-6">
            Você sabe <span className="text-primary">exatamente</span> quantas horas cada aluno ainda tem?
          </motion.h2>
          <motion.div variants={fadeUp} className="space-y-4 text-sm sm:text-base text-muted-foreground leading-relaxed">
            <p>Sabe quem já pagou, quem ainda vai pagar e quanto você vai receber no mês que vem?</p>
            <p>Ou ainda depende de anotações, memória e planilhas confusas?</p>
            <p className="font-semibold text-foreground">A maioria dos professores perde dinheiro e tempo por falta de organização.</p>
          </motion.div>
        </motion.div>
      </section>

      {/* TURN */}
      <section className="py-16 sm:py-20 px-4">
        <motion.div className="max-w-2xl mx-auto text-center" initial="hidden" whileInView="visible" viewport={{ once: true }}>
          <motion.div variants={fadeUp} className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-6">
            <Zap className="h-8 w-8 text-primary" />
          </motion.div>
          <motion.h2 variants={fadeUp} className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-4">
            O problema não é falta de esforço.
          </motion.h2>
          <motion.p variants={fadeUp} className="text-base sm:text-lg text-primary font-semibold">
            É falta de um sistema feito para a sua realidade.
          </motion.p>
        </motion.div>
      </section>

      {/* SOLUTION */}
      <section className="py-16 sm:py-20 px-4 bg-muted/30">
        <motion.div className="max-w-2xl mx-auto text-center" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
          <motion.h2 variants={fadeUp} className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-4">
            O OneTeacher resolve isso de forma <span className="text-primary">simples e inteligente.</span>
          </motion.h2>
          <motion.p variants={fadeUp} className="text-muted-foreground mb-8">Ele conecta tudo em um único lugar:</motion.p>
          <motion.div variants={fadeUp} className="flex flex-wrap items-center justify-center gap-3">
            {["Alunos", "Pacotes de horas", "Agenda", "Financeiro"].map(item => (
              <span key={item} className="px-4 py-2 rounded-full bg-primary/8 border border-primary/15 text-sm font-semibold text-primary">{item}</span>
            ))}
          </motion.div>
          <motion.p variants={fadeUp} className="text-sm text-muted-foreground mt-6 font-medium">Sem planilhas. Sem confusão. Sem erro.</motion.p>
        </motion.div>
      </section>

      {/* FEATURES */}
      <section id="features" className="py-16 sm:py-24 px-4">
        <motion.div className="max-w-5xl mx-auto" initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.1 }} variants={stagger}>
          <motion.div variants={fadeUp} className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-3">Tudo que você precisa</h2>
            <p className="text-muted-foreground">Funcionalidades pensadas para o dia a dia do professor.</p>
          </motion.div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((f, i) => (
              <motion.div key={i} variants={fadeUp}>
                <Card className="card-premium h-full hover:shadow-lg hover:border-primary/20 transition-all duration-300 group">
                  <CardContent className="p-5 sm:p-6">
                    <div className="w-11 h-11 rounded-xl bg-primary/8 flex items-center justify-center mb-4 group-hover:bg-primary/15 transition-colors">
                      <f.icon className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="text-sm font-bold mb-1.5">{f.title}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* BENEFITS */}
      <section className="py-16 sm:py-20 px-4 bg-muted/30">
        <motion.div className="max-w-3xl mx-auto" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
          <motion.h2 variants={fadeUp} className="text-2xl sm:text-3xl font-extrabold tracking-tight text-center mb-10">
            O que muda na sua rotina
          </motion.h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { icon: Shield, text: "Mais organização" },
              { icon: Zap, text: "Mais controle" },
              { icon: Check, text: "Menos erros" },
              { icon: Star, text: "Mais profissionalismo" },
              { icon: BarChart3, text: "Mais previsibilidade financeira" },
              { icon: Smartphone, text: "Funciona no celular" },
            ].map((b, i) => (
              <motion.div key={i} variants={fadeUp} className="flex items-center gap-3.5 p-4 rounded-xl bg-card border border-border/40">
                <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                  <b.icon className="h-4 w-4 text-accent" />
                </div>
                <span className="text-sm font-semibold">{b.text}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* PLANS */}
      <section className="py-16 sm:py-24 px-4">
        <motion.div className="max-w-5xl mx-auto" initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.1 }} variants={stagger}>
          <motion.div variants={fadeUp} className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-3">Planos</h2>
            <p className="text-muted-foreground">Escolha o plano ideal para você.</p>
          </motion.div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {plans.map((plan, i) => (
              <motion.div key={i} variants={fadeUp}>
                <Card className={`card-premium h-full transition-all duration-300 hover:shadow-xl relative group ${plan.highlight ? "border-primary/40 shadow-lg shadow-primary/10 ring-2 ring-primary/20" : "hover:border-primary/20"}`}>
                  {plan.highlight && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider rounded-full">
                      Mais popular
                    </div>
                  )}
                  <CardContent className="p-5 sm:p-6 flex flex-col h-full">
                    <h3 className="text-sm font-bold mb-1">{plan.name}</h3>
                    <p className="text-xs text-muted-foreground mb-4">{plan.desc}</p>
                    <div className="mb-5">
                      <span className="text-2xl sm:text-3xl font-extrabold">{plan.price}</span>
                      <span className="text-xs text-muted-foreground ml-1">{plan.period}</span>
                    </div>
                    <ul className="space-y-2 mb-6 flex-1">
                      {plan.features.map((f, fi) => (
                        <li key={fi} className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Check className="h-3.5 w-3.5 text-accent shrink-0" />
                          {f}
                        </li>
                      ))}
                    </ul>
                    <Button
                      className={`rounded-xl w-full text-sm ${plan.highlight ? "shadow-lg shadow-primary/20" : ""}`}
                      variant={plan.highlight ? "default" : "outline"}
                      onClick={() => setSignupOpen(true)}
                    >
                      {plan.price === "Grátis" ? "Começar grátis" : "Assinar"} <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* CTA */}
      <section className="py-16 sm:py-24 px-4">
        <motion.div className="max-w-2xl mx-auto text-center" initial="hidden" whileInView="visible" viewport={{ once: true }}>
          <motion.div variants={fadeUp} className="p-8 sm:p-12 rounded-3xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/15">
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-4">
              Comece agora e tenha <span className="text-primary">controle total</span> das suas aulas.
            </h2>
            <p className="text-muted-foreground text-sm mb-6">Teste grátis por 10 dias. Sem compromisso.</p>
            <Button size="lg" className="rounded-2xl h-12 px-8 text-base font-semibold shadow-xl shadow-primary/25" onClick={() => setSignupOpen(true)}>
              Criar conta grátis <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </motion.div>
        </motion.div>
      </section>

      {/* FAQ */}
      <section className="py-16 sm:py-24 px-4 bg-muted/30">
        <motion.div className="max-w-2xl mx-auto" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}>
          <motion.h2 variants={fadeUp} className="text-2xl sm:text-3xl font-extrabold tracking-tight text-center mb-10">
            Perguntas frequentes
          </motion.h2>
          <motion.div variants={fadeUp}>
            <Accordion type="single" collapsible className="space-y-3">
              {faqs.map((faq, i) => (
                <AccordionItem key={i} value={`faq-${i}`} className="rounded-xl border border-border/60 bg-card px-4 overflow-hidden">
                  <AccordionTrigger className="text-sm font-semibold hover:no-underline py-4">{faq.q}</AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground pb-4">{faq.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </motion.div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-border/40">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <img src={logo} alt="OneTeacher" className="h-6 object-contain opacity-60" />
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} OneTeacher. Todos os direitos reservados.</p>
        </div>
      </footer>

      {/* Signup Modal */}
      <Dialog open={signupOpen} onOpenChange={setSignupOpen}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Crie sua conta gratuita</DialogTitle>
            <p className="text-xs text-muted-foreground">10 dias grátis. Sem cartão de crédito.</p>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Nome</Label>
              <Input value={signupForm.name} onChange={e => setSignupForm({ ...signupForm, name: e.target.value })} placeholder="Seu nome completo" className="h-10 rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">E-mail</Label>
              <Input type="email" value={signupForm.email} onChange={e => setSignupForm({ ...signupForm, email: e.target.value })} placeholder="seu@email.com" className="h-10 rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Senha</Label>
              <Input type="password" value={signupForm.password} onChange={e => setSignupForm({ ...signupForm, password: e.target.value })} placeholder="Mínimo 6 caracteres" className="h-10 rounded-xl" />
            </div>
            <Button className="w-full h-11 rounded-xl font-semibold shadow-lg shadow-primary/20 mt-2" onClick={handleSignup}>
              Criar conta <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
            <p className="text-[11px] text-center text-muted-foreground">
              Já tem uma conta? <button onClick={() => { setSignupOpen(false); navigate("/login"); }} className="text-primary font-medium hover:underline">Entrar</button>
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
