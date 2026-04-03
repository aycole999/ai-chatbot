import Form from "next/form";

import { Input } from "./ui/input";
import { Label } from "./ui/label";

export function AuthForm({
  action,
  children,
  defaultEmail = "",
}: {
  action: NonNullable<
    string | ((formData: FormData) => void | Promise<void>) | undefined
  >;
  children: React.ReactNode;
  defaultEmail?: string;
}) {
  return (
    <Form action={action} className="flex flex-col gap-6 px-4 py-8 sm:px-12 bg-background/50 backdrop-blur-md rounded-2xl border border-border/50 shadow-2xl">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold tracking-tight">欢迎使用</h1>
        <p className="text-sm text-muted-foreground">请输入您的凭据以访问您的帐户</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label
            className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70"
            htmlFor="email"
          >
            邮箱地址
          </Label>

          <Input
            autoComplete="email"
            autoFocus
            className="h-12 rounded-xl bg-muted/30 border-none px-4 text-md focus-visible:ring-primary/20 focus-visible:bg-background transition-all shadow-inner"
            defaultValue={defaultEmail}
            id="email"
            name="email"
            placeholder="name@example.com"
            required
            type="email"
          />
        </div>

        <div className="space-y-1.5">
          <Label
            className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70"
            htmlFor="password"
          >
            密码
          </Label>

          <Input
            className="h-12 rounded-xl bg-muted/30 border-none px-4 text-md focus-visible:ring-primary/20 focus-visible:bg-background transition-all shadow-inner"
            id="password"
            name="password"
            placeholder="••••••••"
            required
            type="password"
          />
        </div>
      </div>

      <div className="pt-2">
        {children}
      </div>
    </Form>
  );
}
