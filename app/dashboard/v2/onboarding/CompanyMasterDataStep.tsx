'use client';

import { Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  INDUSTRY_OPTIONS,
  type CompanyMasterDataForm,
  isCompanyMasterDataValid,
} from './companyMasterData';

type CompanyMasterDataStepProps = {
  companyDomain: string;
  data: CompanyMasterDataForm;
  onChange: (next: CompanyMasterDataForm) => void;
  onNext: () => void;
};

export function CompanyMasterDataStep({
  companyDomain,
  data,
  onChange,
  onNext,
}: CompanyMasterDataStepProps) {
  const valid = isCompanyMasterDataValid(data);

  function patch<K extends keyof CompanyMasterDataForm>(key: K, value: CompanyMasterDataForm[K]) {
    onChange({ ...data, [key]: value });
  }

  return (
    <Card className="border-slate-200/90 shadow-md">
      <CardHeader>
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Building2 className="h-5 w-5 text-primary" aria-hidden />
          </span>
          <div>
            <CardTitle className="text-xl">Unternehmens-Stammdaten</CardTitle>
            <CardDescription>
              Pflichtangaben für Pässe, Lieferantenkommunikation und Compliance-Inbox (
              <span className="font-medium text-slate-700">@{companyDomain}</span>).
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="companyName">Firma (rechtlicher Name)</Label>
            <Input
              id="companyName"
              value={data.companyName}
              onChange={(e) => patch('companyName', e.target.value)}
              placeholder="Beispiel Import GmbH"
              autoComplete="organization"
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="industry">Branche</Label>
            <Select
              value={data.industry}
              onValueChange={(value) => {
                if (value) patch('industry', value);
              }}
            >
              <SelectTrigger id="industry" className="h-9 w-full">
                <SelectValue placeholder="Branche wählen" />
              </SelectTrigger>
              <SelectContent>
                {INDUSTRY_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="street">Straße &amp; Hausnummer</Label>
            <Input
              id="street"
              value={data.street}
              onChange={(e) => patch('street', e.target.value)}
              placeholder="Musterstraße 12"
              autoComplete="street-address"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="postalCode">PLZ</Label>
            <Input
              id="postalCode"
              value={data.postalCode}
              onChange={(e) => patch('postalCode', e.target.value)}
              placeholder="10115"
              autoComplete="postal-code"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="city">Ort</Label>
            <Input
              id="city"
              value={data.city}
              onChange={(e) => patch('city', e.target.value)}
              placeholder="Berlin"
              autoComplete="address-level2"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="country">Land</Label>
            <Input
              id="country"
              value={data.country}
              onChange={(e) => patch('country', e.target.value)}
              placeholder="Deutschland"
              autoComplete="country-name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="vatId">USt-IdNr. / VAT ID</Label>
            <Input
              id="vatId"
              value={data.vatId}
              onChange={(e) => patch('vatId', e.target.value)}
              placeholder="DE123456789"
            />
          </div>
        </div>

        <Button type="button" className="w-full cursor-pointer" disabled={!valid} onClick={onNext}>
          Weiter
        </Button>
      </CardContent>
    </Card>
  );
}
