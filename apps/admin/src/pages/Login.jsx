import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { Lock, Mail, LogIn, KeyRound } from 'lucide-react';
import './Login.css';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login, authError, user } = useStore();
  const navigate = useNavigate();

  if (user) {
    return <Navigate to="/admin" replace />;
  }

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    const success = await login(email, password);
    setIsLoading(false);
    if (success) {
      navigate('/admin/dashboard');
    }
  };

  return (
    <div className="login-page">
      <div className="login-container glass-panel">
        <div className="login-header">
          <div className="login-icon-wrapper">
            <KeyRound size={32} color="var(--accent-primary)" />
          </div>
          <h1>Cabañas Manuara</h1>
          <p>Panel de Administración</p>
        </div>

        <form onSubmit={handleLogin} className="login-form">
          {authError && <div className="alert alert-danger" style={{ marginBottom: '1.5rem' }}>{authError}</div>}

          <div className="form-group">
            <label className="form-label"><Mail size={16} style={{ display: 'inline', marginRight: '5px', verticalAlign: 'text-bottom' }}/> Correo Electrónico</label>
            <input 
              type="email" 
              className="form-input" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@correo.com"
              required 
            />
          </div>

          <div className="form-group">
            <label className="form-label"><Lock size={16} style={{ display: 'inline', marginRight: '5px', verticalAlign: 'text-bottom' }}/> Contraseña</label>
            <input 
              type="password" 
              className="form-input" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required 
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem', padding: '12px' }} disabled={isLoading}>
            {isLoading ? 'Verificando...' : <><LogIn size={20} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'text-bottom' }}/> Iniciar Sesión</>}
          </button>
        </form>
      </div>
    </div>
  );
}
