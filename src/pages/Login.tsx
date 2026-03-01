import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { MessageSquare, AlertCircle } from 'lucide-react';

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

    // Redirect will happen after auth state updates
  };

  // If already logged in, redirect
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
      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-primary mb-4">
            <MessageSquare size={28} className="text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold">Опросница</h1>
          <p className="text-muted-foreground mt-1">Платформа корпоративной обратной связи и аналитики команд</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Вход в систему</CardTitle>
            <CardDescription>Введите данные вашего аккаунта</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                  <AlertCircle size={16} />
                  {error}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Пароль</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Вход...' : 'Войти'}
              </Button>
            </form>

            <div className="mt-6 pt-6 border-t">
              <p className="text-xs text-muted-foreground mb-3 font-medium">Демо-аккаунты:</p>
              <div className="space-y-1.5">
                {demoAccounts.map(acc => (
                  <button
                    key={acc.email}
                    type="button"
                    onClick={() => { setEmail(acc.email); setPassword(acc.password); }}
                    className="w-full text-left px-3 py-2 rounded-md text-xs hover:bg-muted transition-colors flex justify-between"
                  >
                    <span className="text-muted-foreground">{acc.email}</span>
                    <span className="font-medium">{acc.role}</span>
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
