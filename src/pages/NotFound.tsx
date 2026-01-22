import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import logoImg from '@/assets/logo.jpg';

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center gradient-hero px-4">
      <div className="text-center">
        <img 
          src={logoImg} 
          alt="സംരംഭക.com Logo" 
          className="h-24 w-auto rounded-2xl mx-auto mb-6 shadow-glow opacity-60 transition-all duration-500 hover:opacity-100 hover:scale-110 hover:rotate-6 cursor-pointer"
        />
        <h1 className="mb-2 text-6xl font-bold text-primary">404</h1>
        <p className="mb-6 text-xl text-muted-foreground">Oops! Page not found</p>
        <Link 
          to="/" 
          className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium"
        >
          Return to Home
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
