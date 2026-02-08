PickProd - Comprehensive Web Application Development Prompt
Project Overview
Application Name: PickProd
Tagline: Cada pedido conta
Purpose: Enterprise-grade productivity tracking and bonus calculation system for warehouse separation teams
________________________________________
Technology Stack
Frontend
•	Framework: Next.js 15+ (App Router)
•	Language: TypeScript (strict mode)
•	Styling: Tailwind CSS v4
•	UI Components: shadcn/ui (complete component library)
•	Charts: Recharts for data visualization
•	Forms: React Hook Form + Zod validation
•	State Management: Zustand or React Context API
•	Date Handling: date-fns
•	Idioma: PT-BR
Backend & Database
•	Primary Database: Supabase (PostgreSQL) 
o	Real-time subscriptions
o	Row Level Security (RLS)
o	Authentication
•	Secondary Database: Google Sheets API 
o	Backup and synchronization
o	Legacy system integration
Additional Libraries
•	File Processing: xlsx (SheetJS)
•	PDF Generation: jsPDF + html2canvas
•	Excel Export: exceljs
•	WhatsApp Integration: WhatsApp Business API
•	Data Tables: TanStack Table (React Table v8)
•	Icons: Lucide React
•	Notifications: Sonner or React Hot Toast
________________________________________
Database Schema
Supabase Tables
Table: colaboradores
sql
CREATE TABLE colaboradores (
  id_colaborador UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matricula VARCHAR(50) UNIQUE NOT NULL,
  nome VARCHAR(255) NOT NULL,
  filial VARCHAR(100),
  funcao VARCHAR(100),
  id_filial UUID REFERENCES filiais(id_filial),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
Table: filiais
sql
CREATE TABLE filiais (
  id_filial UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo VARCHAR(50) UNIQUE NOT NULL,
  filial VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
Table: dados
sql
CREATE TABLE dados (
  id_dados UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filial VARCHAR(100),
  ordem_frete VARCHAR(50),
  data_frete DATE,
  carga VARCHAR(50),
  seq_carga VARCHAR(50),
  data_carga DATE,
  nota_fiscal VARCHAR(50),
  item_nf VARCHAR(50),
  qtd_venda DECIMAL(15,2),
  familia VARCHAR(100),
  codigo_produto VARCHAR(50),
  produto VARCHAR(255),
  valor_frete DECIMAL(15,2),
  peso_bruto DECIMAL(15,2),
  peso_liquido DECIMAL(15,2),
  margem_percentual DECIMAL(5,2),
  grupo_veiculo VARCHAR(100),
  codigo_veiculo VARCHAR(50),
  rota VARCHAR(100),
  rede VARCHAR(100),
  cliente VARCHAR(255),
  cidade_cliente VARCHAR(100),
  uf VARCHAR(2),
  paletes DECIMAL(10,2),
  colaborador VARCHAR(255),
  hora_inicial TIME,
  hora_final TIME,
  tempo INTERVAL,
  kg_hs DECIMAL(10,2),
  vol_hs DECIMAL(10,2),
  plt_hs DECIMAL(10,2),
  erro_separacao INTEGER DEFAULT 0,
  erro_entregas INTEGER DEFAULT 0,
  observacao TEXT,
  id_carga_cliente VARCHAR(100) UNIQUE,
  id_filial UUID REFERENCES filiais(id_filial),
  id_colaborador UUID REFERENCES colaboradores(id_colaborador),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_dados_carga ON dados(carga);
CREATE INDEX idx_dados_data_carga ON dados(data_carga);
CREATE INDEX idx_dados_id_carga_cliente ON dados(id_carga_cliente);
CREATE INDEX idx_dados_colaborador ON dados(id_colaborador);
Table: usuarios
sql
CREATE TABLE usuarios (
  id_usuario UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  senha VARCHAR(255) NOT NULL, -- Hashed with bcrypt
  filial VARCHAR(100),
  id_filial UUID REFERENCES filiais(id_filial),
  tipo_usuario VARCHAR(20) CHECK (tipo_usuario IN ('novo', 'colaborador', 'admin')) DEFAULT 'novo',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
Table: fechamento
sql
CREATE TABLE fechamento (
  id_fechamento UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_colaborador UUID REFERENCES colaboradores(id_colaborador),
  id_desconto UUID REFERENCES descontos(id_desconto),
  id_filial UUID REFERENCES filiais(id_filial),
  id_dados UUID REFERENCES dados(id_dados),
  mes_fechamento DATE,
  calculo JSONB, -- Store calculation details
  resultado DECIMAL(10,2),
  atingimento DECIMAL(5,2),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
Table: descontos
#### Table: `descontos`
```sql
CREATE TABLE descontos (
  id_desconto UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador VARCHAR(255),
  id_colaborador UUID REFERENCES colaboradores(id_colaborador),
  id_filial UUID REFERENCES filiais(id_filial),
  data_desconto DATE,
  mes_desconto DATE,
  falta_injustificada INTEGER DEFAULT 0,
  ferias INTEGER DEFAULT 0,
  advertencia INTEGER DEFAULT 0,
  suspensao INTEGER DEFAULT 0,
  atestado INTEGER DEFAULT 0,
  percentual_total DECIMAL(5,2),
  valor_desconto_total DECIMAL(10,2),
  observacao TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_descontos_colaborador ON descontos(id_colaborador);
CREATE INDEX idx_descontos_mes ON descontos(mes_desconto);
``` ________________________________________
Business Logic & Calculations
Productivity Calculation Rules (from regrasprodutividade.png)
Weight Distribution:
•	Kg/Hora: 50%
•	Vol/Hora: 30%
•	Plt/Hora: 20%
Performance Tiers:
typescript
const PRODUCTIVITY_TIERS = {
  kg_hora: [
    { min: 1400, value: 300 },
    { min: 1300, value: 250 },
    { min: 1100, value: 200 },
    { min: 1000, value: 150 },
    { min: 950, value: 100 },
  ],
  vol_hora: [
    { min: 270, value: 300 },
    { min: 240, value: 250 },
    { min: 220, value: 200 },
    { min: 200, value: 150 },
    { min: 190, value: 100 },
  ],
  plt_hora: [
    { min: 2.60, value: 300 },
    { min: 2.30, value: 250 },
    { min: 2.10, value: 200 },
    { min: 1.90, value: 150 },
    { min: 1.80, value: 100 },
  ],
};
Calculation Formula:
typescript
// Base calculations
kg_hs = peso_liquido / (tempo_horas / 24)
vol_hs = qtd_venda / (tempo_horas / 24)
plt_hs = paletes / (tempo_horas / 24)
paletes = peso_liquido / 550

// Productivity value
valor_kg = getTierValue(kg_hs, PRODUCTIVITY_TIERS.kg_hora)
valor_vol = getTierValue(vol_hs, PRODUCTIVITY_TIERS.vol_hora)
valor_plt = getTierValue(plt_hs, PRODUCTIVITY_TIERS.plt_hora)

resultado_bruto = (valor_kg * 0.5) + (valor_vol * 0.3) + (valor_plt * 0.2)
Discount Rules (from regrasdescontos.png)
typescript
const DISCOUNT_RULES = {
  erro_separacao: 0.01, // 1% per error
  erro_entregas: 0.01,  // 1% per error
  falta_injustificada: 1.00, // 100% - loses all bonus
  ferias: 1.00, // 100% - loses all bonus
  advertencia: 0.50, // 50%
  suspensao: 1.00, // 100%
  atestado: {
    ate_2_dias: 0.25,      // 25%
    ate_5_dias: 0.50,      // 50%
    ate_7_dias: 0.70,      // 70%
    acima_7_dias: 1.00,    // 100%
  }
};
Final Calculation:
typescript
// Error deductions
desconto_erros = (erro_separacao + erro_entregas) * 0.01

// Administrative deductions
desconto_admin = sum of applicable discount percentages

// Final bonus
bonus_final = resultado_bruto * (1 - desconto_erros) * (1 - desconto_admin)
bonus_final = Math.max(0, Math.min(bonus_final, 300)) // Cap at R$ 300
Achievement Metrics
typescript
META_INDIVIDUAL = 300.00 // R$ per employee
META_TOTAL = number_of_employees * 300.00
atingimento_percentual = (bonus_final / 300.00) * 100
________________________________________
Application Structure
User Roles & Access Control
1. Novo (New User)
•	Access: Temporária screen only
•	Features: Logout button
2. Colaborador (Employee)
•	Access: All screens except Configurações
•	Features: View, filter, and generate reports
3. Admin (Administrator)
•	Access: Full unrestricted access
•	Features: All employee features + configuration management
________________________________________
Screen Specifications
1. Login/Registration Screen
Login Form:
•	Email input (validated)
•	Password input (min 6 characters, alphanumeric + special chars)
•	Show/hide password toggle
•	Login button
•	Link to registration
Registration Form:
•	Name input
•	Email input (unique validation)
•	Password input (min 6 chars) with strength indicator
•	Show/hide password toggle
•	Register button
•	Default role: novo
Security:
•	bcrypt password hashing
•	JWT token authentication via Supabase Auth
•	Session management
________________________________________
2. Dashboard Screen
Layout: 4 sections
Section 1: Filters
typescript
interface DashboardFilters {
  filial: string[];
  data_carga: Date;
  periodo: PeriodOption;
  colaborador: string[];
  carga: string[];
  nota_fiscal: string[];
  tempo: TimeRange;
  cliente: string[];
  rede: string[];
  cidade_cliente: string[];
  uf: string[];
  produto: string[];
  familia: string[];
  busca: string; // Global search
  resultado: ResultRange;
}

type PeriodOption = 
  | 'hoje' | 'ontem' | 'ultimos_7_dias' | 'ultimos_15_dias'
  | 'mes_atual' | 'mes_anterior' | 'trimestre_atual' | 'trimestre_anterior'
  | 'semestre_atual' | 'semestre_anterior' | 'ano_atual' | 'ano_anterior';
Section 2: KPI Cards (2 rows x 4 columns)
typescript
interface DashboardKPIs {
  total_produtividade: number; // Sum of all employee bonus
  percentual_atingimento: number; // total / (employees * 300)
  total_cargas: number; // Count distinct cargas
  total_pedidos: number; // Count distinct notas_fiscais
  total_kg: number; // Sum peso_liquido
  total_volume: number; // Sum qtd_venda
  total_paletes: number; // Sum (peso_liquido / 550)
  tempo_medio: string; // Average tempo per carga
}
Card Design:
•	Clean, modern card with icon
•	Large number display
•	Subtitle description
•	Trend indicator (optional)
•	Color coding for quick insights
Section 3: Charts
Chart 1: Line Chart - Time Evolution
•	X-axis: Time periods
•	Y-axis: Values
•	Multiple series: Peso Líquido, Volume, Paletes
•	Built-in period filter
•	Interactive tooltips
•	Responsive design
Chart 2: Column Chart - Employee Performance
•	X-axis: Colaborador names
•	Y-axis: Produtividade (R$)
•	Sorted descending
•	Color gradient based on value
Chart 3: Column Chart - Employee Totals
•	X-axis: Colaborador names
•	Y-axis: Multiple metrics (grouped bars)
•	Series: Peso, Volume, Paletes
•	Legend toggle
Chart 4: Column Chart - Branch Performance
•	X-axis: Filial names
•	Y-axis: Produtividade (R$)
•	Comparison view
Chart 5: Column Chart - Branch Totals
•	X-axis: Filial names
•	Y-axis: Multiple metrics
•	Series: Peso, Volume, Paletes
Chart 6: Area Chart - Top 5 Clients by Weight
•	X-axis: Time
•	Y-axis: Peso Líquido
•	Stacked area for top 5 clients
•	Others grouped
Chart 7: Pie Chart - Distribution
•	Customizable metric
•	Interactive segments
•	Percentage labels
Section 4: Summary Tables (4 sections, 2 columns each)
typescript
interface TopPerformer {
  colaborador: string;
  valor: number;
  rank: number;
}

// Tables to display
- Top 3 Cargas Separadas
- Top 3 Pedidos Separados
- Top 3 Produtividade R$
- Top 3 Tonelagem KG
- Top 3 Volumes
- Top 3 Paletes
- Top 3 Tempo Médio
Table Design:
•	Compact 3-row tables
•	Rank badges (1st, 2nd, 3rd)
•	Formatted numbers with units
•	Side-by-side layout
________________________________________
3. Upload Screen
Functionality:
1.	File upload button (accepts .xlsx only)
2.	File processing with progress indicator
3.	Data preview table (first 10 rows)
4.	Validation summary (errors, warnings)
5.	"Registrar dados no Banco" confirmation button
Processing Logic:
typescript
async function processUpload(file: File) {
  // 1. Read XLSX file
  const workbook = XLSX.read(await file.arrayBuffer());
  const data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
  
  // 2. Transform and validate data
  const processedData = data.map((row) => ({
    ...row,
    id_carga_cliente: generateIdCargaCliente(row),
    paletes: row.peso_liquido / 550,
    // Set defaults for user-fillable fields
    colaborador: null,
    hora_inicial: null,
    hora_final: null,
    tempo: null,
    kg_hs: null,
    vol_hs: null,
    plt_hs: null,
    erro_separacao: 0,
    erro_entregas: 0,
    observacao: null,
  }));
  
  // 3. Group by carga and assign same ID
  const groupedByCarga = groupBy(processedData, 'carga');
  const withIds = assignUniqueIdPerCarga(groupedByCarga);
  
  // 4. Save to Supabase
  await supabase.from('dados').insert(withIds);
  
  // 5. Sync to Google Sheets (secondary)
  await syncToGoogleSheets(withIds);
  
  return { success: true, recordCount: withIds.length };
}

function generateIdCargaCliente(row: any): string {
  // Format: {supabase_id}-{carga}-{last_13_digits_of_cliente}
  const clientDigits = row.cliente.toString().slice(-13);
  return `${row.id_dados}-${row.carga}-${clientDigits}`;
}
UI/UX:
•	Drag-and-drop upload zone
•	File size and format validation
•	Progress bar during processing
•	Success/error notifications
•	Preview table with scroll
________________________________________
4. Produtividade Screen
Layout: 2 sections
Section 1: Filters
typescript
interface ProdutividadeFilters {
  id_carga_cliente: string;
  filial: string[];
  data_carga: DateRange;
  periodo: PeriodOption;
  colaborador: string[];
  carga: string[];
  tempo: TimeRange;
  cliente: string[];
  kg_hs: NumberRange;
  vol_hs: NumberRange;
  plt_hs: NumberRange;
  erro_separacao: NumberRange;
  erro_entregas: NumberRange;
  busca: string;
}
Section 2: Data Table
Columns:
•	Id_carga_cliente
•	Filial
•	Carga
•	Data Carga
•	Qtd Venda (sum per carga)
•	Peso Líquido (sum per carga)
•	Paletes (calculated)
•	Colaborador (editable dropdown)
•	Hora Inicial (editable time input)
•	Hora Final (editable time input)
•	Tempo (auto-calculated)
•	Kg/Hs (auto-calculated)
•	Vol/Hs (auto-calculated)
•	Plt/Hs (auto-calculated)
•	Erro Separação (editable integer)
•	Erro Entregas (editable integer)
•	Observação (editable text)
•	Actions (Edit, Delete, Comment buttons)
Features:
•	Inline editing with save/cancel
•	Row-level actions
•	Sorting (default: carga DESC)
•	Pagination: 500 rows per page
•	Horizontal and vertical scroll
•	Compact, professional design
•	Auto-save on edit
•	Validation on required fields
Implementation:
typescript
// TanStack Table configuration
const columns = [
  {
    accessorKey: 'id_carga_cliente',
    header: 'ID Carga Cliente',
    size: 150,
  },
  {
    accessorKey: 'colaborador',
    header: 'Colaborador',
    cell: ({ row }) => (
      <EditableSelect
        value={row.original.colaborador}
        options={colaboradores}
        onSave={(value) => updateRow(row.id, { colaborador: value })}
      />
    ),
  },
  // ... other columns
];
________________________________________
6.	Descontos Screen
// types/database.ts
export interface Desconto {
  id_desconto: string;
  colaborador: string;
  id_colaborador: string;
  id_filial: string;
  data_desconto: Date;
  mes_desconto: Date;
  falta_injustificada: number;
  ferias: number;
  advertencia: number;
  suspensao: number;
  atestado: number;
  percentual_total: number;
  valor_desconto_total: number;
  observacao?: string;
}
Layout: 2 sections
Section 1: Filters
typescript
interface DescontosFilters {
  id: string;
  matricula: string;
  colaborador: string[];
  filial: string[];
  mes: Date;
  falta_injustificada: boolean;
  ferias: boolean;
  advertencia: boolean;
  suspensao: boolean;
  atestado: boolean;
  busca: string;
}
Section 2: Descontos Table
Columns:
•	Id
•	Matrícula
•	Colaborador
•	Filial
•	Mês
•	Falta Injustificada (checkbox/count)
•	Férias (checkbox/count)
•	Advertência (checkbox/count)
•	Suspensão (checkbox/count)
•	Atestado (days count with dropdown for tier)
•	% Total Descontos (calculated)
•	Observação (editable)
•	Actions (Edit, Delete, Comment)
Features:
•	Inline editing
•	Pagination: 100 rows per page
•	Automatic discount % calculation
•	Validation rules enforcement
•	Add new discount button
Discount Calculation Display:
typescript
// Visual indicator of total discount
const totalDesconto = calculateTotalDiscount({
  falta_injustificada: row.falta_injustificada,
  ferias: row.ferias,
  advertencia: row.advertencia,
  suspensao: row.suspensao,
  atestado_dias: row.atestado_dias,
});

// Display with color coding
<Badge variant={totalDesconto >= 1 ? 'destructive' : 'warning'}>
  {(totalDesconto * 100).toFixed(0)}%
</Badge>
________________________________________
6. Resultado Screen
Layout: 3 sections
Section 1: Comprehensive Filters
All relevant filters from previous screens combined.
Section 2: Fechamento Table
Columns:
•	Id
•	Filial
•	Mês
•	Colaborador
•	Peso Líq. Total
•	Volume Total
•	Paletes Total
•	Tempo Total
•	Kg/Hs (average)
•	Vol/Hs (average)
•	Plt/Hs (average)
•	Erros Separação (sum)
•	Erros Entregas (sum)
•	Falta Injustificada
•	Férias
•	Advertência
•	Suspensão
•	Atestado
Features:
•	Monthly aggregation
•	Default: current month
•	Horizontal/vertical scroll
•	Export capabilities
Section 3: Resultados Table
Columns:
•	Filial
•	Mês
•	Matrícula
•	Colaborador
•	Vlr Kg/Hs (R$)
•	Vlr Vol/Hs (R$)
•	Vlr Plt/Hs (R$)
•	% Erros Totais
•	Outros Descontos
•	Produtividade Final R$ (with gradient coloring)
•	Meta (progress bar)
Color Coding:
typescript
// Gradient from red (0) to green (300)
const getColor = (value: number) => {
  const percentage = value / 300;
  const red = Math.round(255 * (1 - percentage));
  const green = Math.round(255 * percentage);
  return `rgb(${red}, ${green}, 0)`;
};
Meta Progress Bar:
typescript
<div className="w-full bg-gray-200 rounded-full h-2.5">
  <div
    className="bg-blue-600 h-2.5 rounded-full transition-all"
    style={{ width: `${(produtividade / 300) * 100}%` }}
  />
</div>
<span className="text-xs text-gray-600">
  R$ {produtividade.toFixed(2)} / R$ 300,00 ({((produtividade / 300) * 100).toFixed(1)}%)
</span>
________________________________________
7. Relatórios Screen
Layout: 3 sections
Section 1: Comprehensive Filters
All filters available for report customization.
Section 2: PDF/HTML Reports
•	Button: Relatório PDF - Generate styled PDF matching provided template
•	Button: Relatório HTML - Interactive HTML version with same layout
Report Structure:
1.	Header section (logo, title, period, date)
2.	KPI cards section (8 cards from dashboard)
3.	Charts section (key charts)
4.	Fechamento table
5.	Resultado table
6.	Produtividade detailed table
7.	Footer (page numbers, generation timestamp)
Implementation:
typescript
async function generatePDF(filters: ReportFilters) {
  const reportData = await fetchReportData(filters);
  const html = renderReportTemplate(reportData);
  
  // Use html2canvas + jsPDF
  const canvas = await html2canvas(html);
  const pdf = new jsPDF('l', 'mm', 'a4');
  pdf.addImage(canvas, 'PNG', 0, 0);
  pdf.save(`relatorio-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
}
Section 3: Excel/CSV/WhatsApp Reports
•	Button: Exportar XLSX - Formatted Excel with tables
•	Button: Exportar CSV - Raw data export
•	Button: Enviar WhatsApp - Share via WhatsApp Business API
Excel Formatting:
typescript
async function generateExcel(data: any[]) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Dados');
  
  // Header styling
  worksheet.getRow(1).font = { 
    name: 'Calibri', 
    size: 12, 
    bold: true, 
    color: { argb: 'FFFFFFFF' } 
  };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF006400' } // Dark green
  };
  
  // Apply borders
  worksheet.eachRow((row, rowNumber) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF90EE90' } },
        left: { style: 'thin', color: { argb: 'FF90EE90' } },
        bottom: { style: 'thin', color: { argb: 'FF90EE90' } },
        right: { style: 'thin', color: { argb: 'FF90EE90' } },
      };
    });
  });
  
  // Enable auto-filter
  worksheet.autoFilter = {
    from: 'A1',
    to: `${String.fromCharCode(64 + columns.length)}1`,
  };
  
  const buffer = await workbook.xlsx.writeBuffer();
  downloadFile(buffer, `dados-${Date.now()}.xlsx`);
}
________________________________________
8. Cadastros Screen
Functionality:
•	Register new colaboradores
•	Edit existing colaboradores
•	View colaborador list
Form Fields:
•	Matrícula (unique)
•	Nome
•	Filial (dropdown)
•	Função
•	Status (active/inactive)
Features:
•	Form validation
•	Duplicate detection
•	Bulk import option
•	Search and filter
•	Export list
________________________________________
9. Configurações Screen (Admin Only)
Layout: Tabbed interface
Tab 1: User Management
•	List all users
•	Edit user details (name, email, filial, role)
•	Change passwords
•	Delete users
•	Create new users (any role)
•	Bulk operations
User Table:
•	Id
•	Nome
•	Email
•	Tipo de Usuário (editable)
•	Filial (editable)
•	Última atividade
•	Actions (Edit, Delete, Reset Password)
Tab 2: Calculation Rules
•	Configure productivity tiers
•	Edit discount percentages
•	Set meta values
•	Adjust formulas
•	Version control for rules
Rule Editor:
typescript
interface CalculationRules {
  productivity_tiers: ProductivityTiers;
  discount_rules: DiscountRules;
  meta_individual: number;
  weight_distribution: {
    kg_hora: number;
    vol_hora: number;
    plt_hora: number;
  };
}

// JSON editor with validation
<JSONEditor
  value={rules}
  onChange={updateRules}
  schema={calculationRulesSchema}
/>
Tab 3: System Settings
•	Application name/logo
•	Email notifications
•	Backup schedules
•	Google Sheets sync settings
•	WhatsApp API configuration
•	Audit logs
________________________________________
10. Temporária Screen (Novo users)
Content:
•	Welcome message
•	"Your account is pending approval"
•	Contact admin information
•	Logout button only
________________________________________
Key Features & Best Practices
1. Authentication & Authorization
typescript
// Middleware for route protection
export async function middleware(request: NextRequest) {
  const session = await getSession(request);
  
  if (!session) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  
  const userRole = session.user.tipo_usuario;
  const path = request.nextUrl.pathname;
  
  // Role-based access control
  if (path.startsWith('/configuracoes') && userRole !== 'admin') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }
  
  if (userRole === 'novo' && path !== '/temporaria') {
    return NextResponse.redirect(new URL('/temporaria', request.url));
  }
  
  return NextResponse.next();
}
2. Real-time Updates
typescript
// Supabase real-time subscription
useEffect(() => {
  const channel = supabase
    .channel('dados-changes')
    .on('postgres_changes', 
      { event: '*', schema: 'public', table: 'dados' },
      (payload) => {
        // Update local state
        handleDataChange(payload);
      }
    )
    .subscribe();
    
  return () => {
    supabase.removeChannel(channel);
  };
}, []);
3. Performance Optimization
•	Server-side pagination
•	Lazy loading for charts
•	Memoization for expensive calculations
•	Debounced search inputs
•	Virtual scrolling for large tables
•	Image optimization (Next.js Image)
•	Code splitting by route
4. Data Validation
typescript
// Zod schemas for validation
const dadosSchema = z.object({
  carga: z.string().min(1),
  data_carga: z.date(),
  peso_liquido: z.number().positive(),
  qtd_venda: z.number().positive(),
  colaborador: z.string().optional(),
  hora_inicial: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
  hora_final: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
  erro_separacao: z.number().int().min(0).default(0),
  erro_entregas: z.number().int().min(0).default(0),
  // ... other fields
});
5. Error Handling
typescript
// Global error boundary
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <div className="flex flex-col items-center justify-center min-h-screen">
          <h2 className="text-2xl font-bold mb-4">Algo deu errado!</h2>
          <p className="text-gray-600 mb-4">{error.message}</p>
          <button onClick={() => reset()}>Tentar novamente</button>
        </div>
      </body>
    </html>
  );
}
6. Accessibility
•	ARIA labels
•	Keyboard navigation
•	Focus management
•	Screen reader support
•	Color contrast compliance (WCAG AA)
•	Responsive typography
7. Responsive Design
•	Mobile-first approach
•	Breakpoints: sm (640px), md (768px), lg (1024px), xl (1280px), 2xl (1536px)
•	Touch-friendly UI elements
•	Adaptive table layouts (horizontal scroll on mobile)
•	Collapsible filters on small screens
8. Security
•	SQL injection prevention (parameterized queries)
•	XSS protection (sanitized inputs)
•	CSRF tokens
•	Rate limiting
•	Secure password storage (bcrypt)
•	Row-level security (Supabase RLS)
•	HTTPS enforcement
________________________________________
Development Workflow
1. Project Setup
bash
# Initialize Next.js project
npx create-next-app@latest pickprod --typescript --tailwind --app

# Install dependencies
npm install @supabase/supabase-js @tanstack/react-table recharts
npm install react-hook-form zod @hookform/resolvers
npm install date-fns xlsx exceljs jspdf html2canvas
npm install zustand sonner lucide-react

# Install shadcn/ui
npx shadcn-ui@latest init
npx shadcn-ui@latest add button input table card select dialog
npx shadcn-ui@latest add form dropdown-menu badge separator
npx shadcn-ui@latest add sheet tabs alert calendar
2. Environment Variables
env
# .env.local
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

GOOGLE_SHEETS_API_KEY=your_google_api_key
GOOGLE_SHEETS_SPREADSHEET_ID=your_spreadsheet_id

WHATSAPP_API_TOKEN=your_whatsapp_token
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id

NEXTAUTH_SECRET=your_nextauth_secret
NEXTAUTH_URL=http://localhost:3000
```

### 3. Folder Structure
```
pickprod/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   └── cadastro/
│   ├── (dashboard)/
│   │   ├── dashboard/
│   │   ├── upload/
│   │   ├── produtividade/
│   │   ├── descontos/
│   │   ├── resultado/
│   │   ├── relatorios/
│   │   ├── cadastros/
│   │   └── configuracoes/
│   ├── temporaria/
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── ui/ (shadcn components)
│   ├── charts/
│   ├── tables/
│   ├── filters/
│   └── layout/
├── lib/
│   ├── supabase/
│   ├── calculations/
│   ├── validations/
│   └── utils/
├── hooks/
├── types/
├── public/
└── styles/
4. TypeScript Types
typescript
// types/database.ts
export interface Colaborador {
  id_colaborador: string;
  matricula: string;
  nome: string;
  filial: string;
  funcao: string;
  id_filial: string;
}

export interface Dados {
  id_dados: string;
  filial: string;
  carga: string;
  data_carga: Date;
  peso_liquido: number;
  qtd_venda: number;
  paletes: number;
  colaborador?: string;
  hora_inicial?: string;
  hora_final?: string;
  tempo?: string;
  kg_hs?: number;
  vol_hs?: number;
  plt_hs?: number;
  erro_separacao: number;
  erro_entregas: number;
  id_carga_cliente: string;
  // ... other fields
}

export interface Desconto {
  id_desconto: string;
  colaborador: string;
  id_colaborador: string;
  motivo: 'falta_injustificada' | 'ferias' | 'advertencia' | 'suspensao' | 'atestado';
  percentual: number;
  mes_desconto: Date;
  valor_desconto: number;
}

export interface Usuario {
  id_usuario: string;
  nome: string;
  email: string;
  tipo_usuario: 'novo' | 'colaborador' | 'admin';
  filial: string;
  id_filial: string;
}
________________________________________
Testing Strategy
1. Unit Tests
•	Calculation functions
•	Validation schemas
•	Utility functions
•	Component logic
2. Integration Tests
•	API routes
•	Database operations
•	Authentication flows
3. E2E Tests
•	User workflows (Playwright)
•	Critical paths
•	Multi-user scenarios
________________________________________
Deployment
Production Checklist
•	Environment variables configured
•	Database migrations applied
•	RLS policies enabled
•	CORS configured
•	CDN setup for static assets
•	Error tracking (Sentry)
•	Performance monitoring
•	Backup strategy
•	SSL certificate
•	Rate limiting
Recommended Hosting
•	Frontend: Vercel
•	Database: Supabase (managed)
•	File Storage: Supabase Storage or AWS S3
•	CDN: Cloudflare
________________________________________
Future Enhancements
1.	Mobile app (React Native)
2.	Advanced analytics with AI insights
3.	Automated email reports
4.	Integration with ERP systems
5.	Gamification features
6.	Voice input for data entry
7.	Offline mode with sync
8.	Multi-language support
9.	Custom dashboard builder
10.	API for third-party integrations
________________________________________
This comprehensive prompt provides all necessary details for a senior fullstack developer to build the PickProd application with professional quality, following industry best practices, and ensuring scalability and maintainability.
Complemento - Melhorias e Funcionalidades Avançadas para PickProd
1. Sistema de Notificações e Alertas
Implementação de Central de Notificações
typescript
// types/notifications.ts
export interface Notification {
  id_notificacao: string;
  id_usuario: string;
  tipo: 'info' | 'warning' | 'error' | 'success';
  categoria: 'sistema' | 'produtividade' | 'desconto' | 'meta' | 'aprovacao';
  titulo: string;
  mensagem: string;
  lida: boolean;
  acao_url?: string;
  acao_texto?: string;
  data_criacao: Date;
  data_leitura?: Date;
}
Tabela Supabase para Notificações
sql
CREATE TABLE notificacoes (
  id_notificacao UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_usuario UUID REFERENCES usuarios(id_usuario),
  tipo VARCHAR(20) CHECK (tipo IN ('info', 'warning', 'error', 'success')),
  categoria VARCHAR(50),
  titulo VARCHAR(255) NOT NULL,
  mensagem TEXT NOT NULL,
  lida BOOLEAN DEFAULT FALSE,
  acao_url TEXT,
  acao_texto VARCHAR(100),
  data_criacao TIMESTAMP DEFAULT NOW(),
  data_leitura TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_notificacoes_usuario ON notificacoes(id_usuario, lida);
CREATE INDEX idx_notificacoes_data ON notificacoes(data_criacao DESC);
Regras de Notificações Automáticas
typescript
// Gatilhos para notificações automáticas
const NOTIFICATION_TRIGGERS = {
  // Meta não atingida
  meta_baixa: {
    trigger: (produtividade: number) => produtividade < 150,
    tipo: 'warning',
    titulo: 'Atenção: Meta abaixo de 50%',
    mensagem: 'Sua produtividade está abaixo de 50% da meta. Fale com seu supervisor.',
  },
  
  // Erros acima da média
  erros_excessivos: {
    trigger: (erros: number) => erros > 10,
    tipo: 'error',
    titulo: 'Alerta: Erros excessivos',
    mensagem: 'Você teve mais de 10 erros neste período. Verifique os procedimentos.',
  },
  
  // Meta atingida
  meta_atingida: {
    trigger: (produtividade: number) => produtividade >= 300,
    tipo: 'success',
    titulo: 'Parabéns! Meta 100% atingida',
    mensagem: 'Você atingiu o bônus máximo de R$ 300,00 neste mês!',
  },
  
  // Novo desconto aplicado
  desconto_aplicado: {
    tipo: 'info',
    titulo: 'Desconto aplicado',
    mensagem: 'Um novo desconto foi registrado em sua conta. Verifique os detalhes.',
  },
  
  // Upload de dados concluído
  upload_concluido: {
    tipo: 'success',
    titulo: 'Upload processado com sucesso',
    mensagem: '{count} registros foram importados e estão disponíveis no sistema.',
  },
};
Componente de Notificações no Header
typescript
// components/NotificationBell.tsx
import { Bell } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export function NotificationBell() {
  const { notifications, unreadCount } = useNotifications();
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <div className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0">
              {unreadCount}
            </Badge>
          )}
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80 max-h-96 overflow-y-auto">
        {notifications.map((notif) => (
          <NotificationItem key={notif.id_notificacao} notification={notif} />
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
________________________________________
2. Sistema de Auditoria e Logs
Tabela de Auditoria
sql
CREATE TABLE auditoria (
  id_auditoria UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_usuario UUID REFERENCES usuarios(id_usuario),
  acao VARCHAR(50) NOT NULL, -- 'create', 'update', 'delete', 'export', 'login'
  tabela VARCHAR(50),
  registro_id UUID,
  dados_anteriores JSONB,
  dados_novos JSONB,
  ip_address INET,
  user_agent TEXT,
  timestamp TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_auditoria_usuario ON auditoria(id_usuario);
CREATE INDEX idx_auditoria_timestamp ON auditoria(timestamp DESC);
CREATE INDEX idx_auditoria_tabela ON auditoria(tabela, registro_id);
Middleware de Auditoria
typescript
// lib/audit.ts
export async function logAudit({
  userId,
  action,
  table,
  recordId,
  oldData,
  newData,
  request,
}: AuditLogParams) {
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip');
  const userAgent = request.headers.get('user-agent');
  
  await supabase.from('auditoria').insert({
    id_usuario: userId,
    acao: action,
    tabela: table,
    registro_id: recordId,
    dados_anteriores: oldData,
    dados_novos: newData,
    ip_address: ip,
    user_agent: userAgent,
  });
}
________________________________________
3. Dashboard Personalizável com Drag-and-Drop
Permitir que usuários customizem seu dashboard
typescript
// types/dashboard.ts
export interface DashboardWidget {
  id: string;
  type: 'card' | 'chart' | 'table';
  title: string;
  size: 'small' | 'medium' | 'large' | 'full';
  position: { x: number; y: number };
  config: Record<string, any>;
  visible: boolean;
}

export interface DashboardLayout {
  id_layout: string;
  id_usuario: string;
  nome_layout: string;
  widgets: DashboardWidget[];
  is_default: boolean;
}
Tabela de Layouts Personalizados
sql
CREATE TABLE dashboard_layouts (
  id_layout UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_usuario UUID REFERENCES usuarios(id_usuario),
  nome_layout VARCHAR(100) NOT NULL,
  widgets JSONB NOT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_layouts_usuario ON dashboard_layouts(id_usuario);
Implementação com react-grid-layout
typescript
// components/CustomDashboard.tsx
import GridLayout from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';

export function CustomDashboard() {
  const [layout, setLayout] = useState<DashboardLayout>();
  
  return (
    <div>
      <div className="flex justify-between mb-4">
        <h1>Meu Dashboard</h1>
        <Button onClick={() => setEditMode(!editMode)}>
          {editMode ? 'Salvar Layout' : 'Personalizar'}
        </Button>
      </div>
      
      <GridLayout
        className="layout"
        layout={layout?.widgets}
        cols={12}
        rowHeight={30}
        width={1200}
        isDraggable={editMode}
        isResizable={editMode}
        onLayoutChange={handleLayoutChange}
      >
        {layout?.widgets.map(widget => (
          <div key={widget.id} data-grid={widget.position}>
            <WidgetRenderer widget={widget} />
          </div>
        ))}
      </GridLayout>
    </div>
  );
}
________________________________________
4. Sistema de Metas e Gamificação
Conquistas e Badges
typescript
// types/achievements.ts
export interface Achievement {
  id_conquista: string;
  nome: string;
  descricao: string;
  icone: string;
  tipo: 'produtividade' | 'qualidade' | 'consistencia' | 'marco';
  criterio: {
    metrica: string;
    operador: '>=' | '>' | '<=' | '<' | '==';
    valor: number;
    periodo?: string;
  };
  recompensa_pontos: number;
  badge_color: string;
}

export interface UserAchievement {
  id_usuario_conquista: string;
  id_usuario: string;
  id_conquista: string;
  data_obtencao: Date;
  progresso?: number;
}
Exemplos de Conquistas
typescript
const ACHIEVEMENTS = [
  {
    nome: 'Velocista',
    descricao: 'Atinja 1400 Kg/Hora ou mais',
    icone: '⚡',
    criterio: { metrica: 'kg_hs', operador: '>=', valor: 1400 },
    recompensa_pontos: 50,
    badge_color: 'gold',
  },
  {
    nome: 'Mestre da Precisão',
    descricao: 'Complete um mês sem nenhum erro',
    icone: '🎯',
    criterio: { metrica: 'erros_total', operador: '==', valor: 0, periodo: 'mes' },
    recompensa_pontos: 100,
    badge_color: 'platinum',
  },
  {
    nome: 'Consistência',
    descricao: 'Atinja a meta por 3 meses consecutivos',
    icone: '🔥',
    criterio: { metrica: 'meses_consecutivos_meta', operador: '>=', valor: 3 },
    recompensa_pontos: 150,
    badge_color: 'diamond',
  },
  {
    nome: 'Top Performer',
    descricao: 'Fique entre os 3 primeiros do mês',
    icone: '👑',
    criterio: { metrica: 'ranking_mensal', operador: '<=', valor: 3 },
    recompensa_pontos: 75,
    badge_color: 'gold',
  },
];
Ranking e Leaderboard
typescript
// components/Leaderboard.tsx
export function Leaderboard({ period = 'month' }) {
  const { rankings } = useRankings(period);
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>🏆 Ranking do Mês</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {rankings.map((rank, index) => (
            <div 
              key={rank.id_colaborador}
              className={cn(
                "flex items-center justify-between p-3 rounded-lg",
                index === 0 && "bg-yellow-50 border-2 border-yellow-400",
                index === 1 && "bg-gray-50 border-2 border-gray-400",
                index === 2 && "bg-orange-50 border-2 border-orange-400"
              )}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl font-bold">
                  {index === 0 && '🥇'}
                  {index === 1 && '🥈'}
                  {index === 2 && '🥉'}
                  {index > 2 && `#${index + 1}`}
                </span>
                <div>
                  <p className="font-semibold">{rank.nome}</p>
                  <p className="text-sm text-gray-600">{rank.filial}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-bold text-green-600">
                  R$ {rank.produtividade_final.toFixed(2)}
                </p>
                <p className="text-xs text-gray-500">
                  {rank.atingimento_percentual.toFixed(1)}%
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
________________________________________
5. Comparativo e Benchmarking
Análise Comparativa de Performance
typescript
// components/PerformanceComparison.tsx
export function PerformanceComparison() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sua Performance vs Média da Equipe</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <ComparisonBar
            label="Kg/Hora"
            userValue={1250}
            teamAverage={1100}
            topPerformer={1450}
            max={1500}
          />
          <ComparisonBar
            label="Vol/Hora"
            userValue={225}
            teamAverage={210}
            topPerformer={270}
            max={300}
          />
          <ComparisonBar
            label="Produtividade R$"
            userValue={275}
            teamAverage={220}
            topPerformer={300}
            max={300}
            isCurrency
          />
        </div>
      </CardContent>
    </Card>
  );
}

function ComparisonBar({ label, userValue, teamAverage, topPerformer, max, isCurrency = false }) {
  const format = (val: number) => isCurrency ? `R$ ${val}` : val.toString();
  
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-gray-600">
          Você: <strong>{format(userValue)}</strong> | 
          Média: {format(teamAverage)} | 
          Top: {format(topPerformer)}
        </span>
      </div>
      <div className="relative h-8 bg-gray-100 rounded-full overflow-hidden">
        {/* Team Average */}
        <div 
          className="absolute h-full bg-blue-200"
          style={{ width: `${(teamAverage / max) * 100}%` }}
        />
        {/* User Value */}
        <div 
          className="absolute h-full bg-green-500"
          style={{ width: `${(userValue / max) * 100}%` }}
        />
        {/* Top Performer Marker */}
        <div 
          className="absolute h-full w-1 bg-yellow-500"
          style={{ left: `${(topPerformer / max) * 100}%` }}
        />
      </div>
    </div>
  );
}
________________________________________
6. Modo Offline e PWA
Transformar em Progressive Web App
typescript
// next.config.js
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
});

module.exports = withPWA({
  // ... outras configurações
});
Manifest.json
json
{
  "name": "PickProd - Gestão de Produtividade",
  "short_name": "PickProd",
  "description": "Cada pedido conta",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#006400",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
Service Worker para Cache
typescript
// lib/offline-sync.ts
export class OfflineSync {
  private dbName = 'pickprod-offline';
  private db: IDBDatabase;
  
  async savePendingChanges(table: string, data: any) {
    // Salva alterações localmente quando offline
    const transaction = this.db.transaction(['pending'], 'readwrite');
    const store = transaction.objectStore('pending');
    
    await store.add({
      table,
      data,
      timestamp: Date.now(),
      synced: false,
    });
  }
  
  async syncWhenOnline() {
    // Sincroniza quando voltar online
    if (navigator.onLine) {
      const pending = await this.getPendingChanges();
      
      for (const change of pending) {
        try {
          await supabase.from(change.table).insert(change.data);
          await this.markAsSynced(change.id);
        } catch (error) {
          console.error('Sync error:', error);
        }
      }
    }
  }
}
________________________________________
7. Exportação Avançada e Agendamento
Relatórios Automáticos Agendados
typescript
// types/scheduled-reports.ts
export interface ScheduledReport {
  id_agendamento: string;
  id_usuario: string;
  nome_relatorio: string;
  tipo: 'pdf' | 'xlsx' | 'csv';
  frequencia: 'diaria' | 'semanal' | 'mensal';
  dia_semana?: number; // 0-6 (Domingo-Sábado)
  dia_mes?: number; // 1-31
  hora: string; // HH:mm
  filtros: Record<string, any>;
  destinatarios: string[]; // emails
  ativo: boolean;
  ultima_execucao?: Date;
  proxima_execucao: Date;
}
Tabela de Agendamentos
sql
CREATE TABLE agendamentos_relatorios (
  id_agendamento UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_usuario UUID REFERENCES usuarios(id_usuario),
  nome_relatorio VARCHAR(255) NOT NULL,
  tipo VARCHAR(10) CHECK (tipo IN ('pdf', 'xlsx', 'csv')),
  frequencia VARCHAR(20) CHECK (frequencia IN ('diaria', 'semanal', 'mensal')),
  dia_semana INTEGER CHECK (dia_semana BETWEEN 0 AND 6),
  dia_mes INTEGER CHECK (dia_mes BETWEEN 1 AND 31),
  hora TIME NOT NULL,
  filtros JSONB,
  destinatarios TEXT[], -- Array de emails
  ativo BOOLEAN DEFAULT TRUE,
  ultima_execucao TIMESTAMP,
  proxima_execucao TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
Componente de Agendamento
typescript
// components/ScheduleReportDialog.tsx
export function ScheduleReportDialog() {
  const form = useForm<ScheduledReport>();
  
  return (
    <Dialog>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Agendar Relatório Automático</DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <FormField name="nome_relatorio" label="Nome do Relatório" />
          
          <FormField name="tipo" label="Formato">
            <Select>
              <SelectItem value="pdf">PDF</SelectItem>
              <SelectItem value="xlsx">Excel</SelectItem>
              <SelectItem value="csv">CSV</SelectItem>
            </Select>
          </FormField>
          
          <FormField name="frequencia" label="Frequência">
            <Select>
              <SelectItem value="diaria">Diária</SelectItem>
              <SelectItem value="semanal">Semanal</SelectItem>
              <SelectItem value="mensal">Mensal</SelectItem>
            </Select>
          </FormField>
          
          {form.watch('frequencia') === 'semanal' && (
            <FormField name="dia_semana" label="Dia da Semana">
              <Select>
                <SelectItem value="0">Domingo</SelectItem>
                <SelectItem value="1">Segunda</SelectItem>
                {/* ... outros dias */}
              </Select>
            </FormField>
          )}
          
          <FormField name="hora" label="Horário" type="time" />
          
          <FormField name="destinatarios" label="Destinatários (emails separados por vírgula)" />
          
          <Button type="submit">Agendar Relatório</Button>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
________________________________________
8. Chat de Suporte Integrado
Sistema de Tickets/Suporte
typescript
// types/support.ts
export interface Ticket {
  id_ticket: string;
  id_usuario: string;
  assunto: string;
  mensagem: string;
  categoria: 'tecnico' | 'duvida' | 'sugestao' | 'reclamacao';
  prioridade: 'baixa' | 'media' | 'alta' | 'urgente';
  status: 'aberto' | 'em_andamento' | 'resolvido' | 'fechado';
  anexos?: string[];
  resposta?: string;
  atendente?: string;
  data_abertura: Date;
  data_resposta?: Date;
  data_fechamento?: Date;
}
Widget de Chat Flutuante
typescript
// components/SupportChat.tsx
export function SupportChat() {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <>
      {/* Botão flutuante */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 h-14 w-14 rounded-full bg-green-600 text-white shadow-lg hover:bg-green-700 flex items-center justify-center z-50"
      >
        <MessageCircle className="h-6 w-6" />
      </button>
      
      {/* Chat Widget */}
      {isOpen && (
        <Card className="fixed bottom-20 right-4 w-96 h-[500px] shadow-2xl z-50 flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Suporte PickProd</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          
          <CardContent className="flex-1 overflow-y-auto">
            <TicketForm />
          </CardContent>
        </Card>
      )}
    </>
  );
}
________________________________________
9. Análise Preditiva com IA
Previsão de Performance
typescript
// lib/predictions.ts
export async function predictPerformance(colaboradorId: string) {
  // Busca histórico dos últimos 6 meses
  const historico = await getHistorico(colaboradorId, 6);
  
  // Calcula tendências
  const tendenciaKgHs = calculateTrend(historico.map(h => h.kg_hs));
  const tendenciaErros = calculateTrend(historico.map(h => h.erros_total));
  
  // Previsão para próximo mês
  const previsao = {
    kg_hs_previsto: tendenciaKgHs.nextValue,
    produtividade_prevista: estimateProdutividade(tendenciaKgHs.nextValue),
    probabilidade_meta: calculateMetaProbability(historico),
    recomendacoes: generateRecommendations(historico),
  };
  
  return previsao;
}

function generateRecommendations(historico: any[]) {
  const recommendations = [];
  
  const avgErros = mean(historico.map(h => h.erros_total));
  if (avgErros > 5) {
    recommendations.push({
      tipo: 'melhoria',
      area: 'qualidade',
      mensagem: 'Foque em reduzir erros. Sua média está acima do ideal.',
      impacto_estimado: '+R$ 30,00',
    });
  }
  
  const tendenciaVelocidade = calculateTrend(historico.map(h => h.kg_hs));
  if (tendenciaVelocidade.isDecreasing) {
    recommendations.push({
      tipo: 'alerta',
      area: 'velocidade',
      mensagem: 'Sua velocidade está diminuindo. Considere revisar seu método de trabalho.',
      impacto_estimado: '-R$ 50,00',
    });
  }
  
  return recommendations;
}
Card de Previsão no Dashboard
typescript
// components/PerformancePrediction.tsx
export function PerformancePrediction({ colaboradorId }) {
  const { prediction, loading } = usePrediction(colaboradorId);
  
  if (loading) return <Skeleton />;
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>🔮 Previsão para Próximo Mês</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600">Produtividade Prevista</p>
            <p className="text-2xl font-bold text-green-600">
              R$ {prediction.produtividade_prevista.toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Chance de Atingir Meta</p>
            <p className="text-2xl font-bold">
              {prediction.probabilidade_meta.toFixed(0)}%
            </p>
          </div>
        </div>
        
        <Separator />
        
        <div>
          <h4 className="font-semibold mb-2">Recomendações:</h4>
          <div className="space-y-2">
            {prediction.recomendacoes.map((rec, idx) => (
              <Alert key={idx} variant={rec.tipo === 'alerta' ? 'destructive' : 'default'}>
                <AlertTitle className="text-sm">{rec.area}</AlertTitle>
                <AlertDescription className="text-xs">
                  {rec.mensagem}
                  <span className="font-semibold ml-2">{rec.impacto_estimado}</span>
                </AlertDescription>
              </Alert>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
________________________________________

11. Modo Escuro (Dark Mode)
Implementação com next-themes
typescript
// app/providers.tsx
import { ThemeProvider } from 'next-themes';

export function Providers({ children }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      {children}
    </ThemeProvider>
  );
}

// components/ThemeToggle.tsx
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={() => setTheme('light')}>
          Claro
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('dark')}>
          Escuro
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('system')}>
          Sistema
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
________________________________________
12. Tutoriais Interativos (Onboarding)
Tour Guiado para Novos Usuários
typescript
// lib/tour.ts
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';

export const dashboardTour = driver({
  showProgress: true,
  steps: [
    {
      element: '#filters-section',
      popover: {
        title: 'Filtros',
        description: 'Use os filtros para refinar os dados exibidos no dashboard.',
      },
    },
    {
      element: '#kpi-cards',
      popover: {
        title: 'Indicadores Principais',
        description: 'Aqui você vê um resumo da sua produtividade e performance.',
      },
    },
    {
      element: '#charts-section',
      popover: {
        title: 'Gráficos',
        description: 'Visualize sua evolução ao longo do tempo e compare com a equipe.',
      },
    },
    {
      element: '#leaderboard',
      popover: {
        title: 'Ranking',
        description: 'Veja sua posição no ranking mensal da equipe.',
      },
    },
  ],
});

// Iniciar tour automaticamente para novos usuários
useEffect(() => {
  const hasSeenTour = localStorage.getItem('dashboard-tour-completed');
  if (!hasSeenTour) {
    dashboardTour.drive();
    localStorage.setItem('dashboard-tour-completed', 'true');
  }
}, []);
________________________________________
Resumo das Melhorias
Estas funcionalidades adicionam:
1.	✅ Notificações em Tempo Real - Mantém usuários informados
2.	✅ Auditoria Completa - Rastreabilidade de todas as ações
3.	✅ Dashboard Personalizável - UX adaptável ao usuário
4.	✅ Gamificação - Engajamento e motivação da equipe
5.	✅ Benchmarking - Comparação inteligente de performance
6.	✅ PWA/Offline - Funciona sem internet
7.	✅ Relatórios Agendados - Automação de rotinas
8.	✅ Suporte Integrado - Atendimento ágil
9.	✅ IA Preditiva - Insights para melhorias
10.	✅ Scanner Mobile - Agilidade no registro
11.	✅ Dark Mode - Conforto visual
12.	✅ Onboarding - Facilita adoção
Todas essas implementações elevam o PickProd de um sistema de gestão tradicional para uma plataforma moderna, engajadora e orientada a resultados.

Comentarios nos códigos sempre em português.
Lembre-se que você é um desenvolvedor sênior web fullstack, especialista em frontend, backend e banco de dados e logística. Use sua máxima capacidade e inteligência, dados, organização, design corporativo, segurança, responsividade e muito mais.
