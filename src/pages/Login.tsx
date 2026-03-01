import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, role } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    const { error: err } = await signIn(email, password);
    setLoading(false);

    if (err) {
      setError('Неверный email или пароль');
      return;
    }
  };

  const { user } = useAuth();
  if (user && role) {
    const dest = role === 'employee' ? '/feedback/new' : '/dashboard';
    navigate(dest, { replace: true });
  }

  const demoAccounts = [
    { email: 'admin@demo.com', password: 'admin123', role: 'Админ' },
    { email: 'hr@demo.com', password: 'hr123', role: 'HR' },
    { email: 'manager@demo.com', password: 'manager123', role: 'Менеджер' },
    { email: 'employee1@demo.com', password: 'emp123', role: 'Сотрудник' },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm animate-fade-in">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold tracking-widest text-foreground">
            М<span className="relative">И<span className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-accent" /></span>РА
          </h1>
          <p className="text-muted-foreground mt-1.5 text-xs">Платформа обратной связи и развития команд</p>
        </div>

        <Card>
          <CardContent className="pt-5">
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-destructive/8 text-destructive text-xs">
                  <AlertCircle size={14} />
                  {error}
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs">Пароль</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  className="h-9 text-sm"
                />
              </div>
              <Button type="submit" className="w-full h-9 text-sm" disabled={loading}>
                {loading ? 'Вход...' : 'Войти'}
              </Button>
            </form>

            <div className="mt-5 pt-4 border-t">
              <p className="text-[10px] text-muted-foreground mb-2 font-medium uppercase tracking-wider">Демо-аккаунты</p>
              <div className="space-y-0.5">
                {demoAccounts.map(acc => (
                  <button
                    key={acc.email}
                    type="button"
                    onClick={() => { setEmail(acc.email); setPassword(acc.password); }}
                    className="w-full text-left px-2.5 py-1.5 rounded-md text-xs hover:bg-muted transition-colors duration-150 flex justify-between items-center"
                  >
                    <span className="text-muted-foreground">{acc.email}</span>
                    <span className="font-medium text-foreground">{acc.role}</span>
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
