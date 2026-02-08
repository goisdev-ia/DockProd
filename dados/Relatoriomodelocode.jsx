import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Separator } from '../components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  BarChart3,
  Download,
  Filter,
  FileText,
  PieChart,
  Activity,
  DollarSign,
  Truck,
  Users,
  Clock,
  MapPin,
  Target,
  Zap,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle,
  Minus,
  FileBarChart,
  LineChart,
  AlertTriangle,
  FileSpreadsheet,
  FileCode,
  MessageCircle,
  Calendar,
  Search,
  X,
  TrendingUp,
  Package,
  XCircle,
  RotateCcw,
  Eye,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import PageHeader from '../components/PageHeader.jsx';
import { getRelatoriosStatistics, getFilterOptions, getRegistrosWithFilters, normalizeStatus } from '../lib/supabase';
import { API_URL } from '../config/api';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '../components/ui/select';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { parseLocalDate } from '../utils/dateUtils';
import { Bar, Line, Pie, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

const Relatorios = () => {
  const { userData } = useAuth();
  const reportRef = useRef(null);

  // Função auxiliar para contar status considerando variações
  const countStatus = (statusList, target) => {
    const targetUpper = target.toUpperCase()
    return statusList.filter(r => {
      const statusNorm = normalizeStatus(r.status)
      if (targetUpper === 'CANCELADA') {
        return statusNorm === 'CANCELADO' || statusNorm === 'CANCELADA'
      }
      if (targetUpper === 'DEVOLVIDA') {
        return statusNorm === 'DEVOLVIDA' || statusNorm === 'DEVOLVIDO'
      }
      if (targetUpper === 'REENVIADA') {
        return statusNorm === 'REENVIADA' || statusNorm === 'REENVIADO'
      }
      if (targetUpper === 'PAGA') {
        return statusNorm === 'PAGA' || statusNorm === 'PAGO'
      }
      return statusNorm === targetUpper
    }).length
  }

  // Verificação de permissões
  const tipo = (userData?.tipo || '').toLowerCase();
  const isAdmin = tipo === 'administrador';
  const isGerencia = tipo === 'gerencia';
  const isColaborador = tipo === 'colaborador';
  const canViewReports = isAdmin || isGerencia || isColaborador;

  // Filtros completos igual a tela Registros
  const [filtros, setFiltros] = useState({
    dateFrom: '',
    dateTo: '',
    period: '',
    fretista: '',
    placa: '',
    cliente: '',
    rede: '',
    vendedor: '',
    uf: '',
    status: '',
    situacao: '',
    searchText: '',
    dateRange: {
      start: '',
      end: ''
    }
  });

  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [registros, setRegistros] = useState([]);
  const [registrosPendentes, setRegistrosPendentes] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 100;
  const maxRegistros = 200;

  const [estatisticas, setEstatisticas] = useState({
    total: 0,
    pendentes: 0,
    valorTotal: 0,
    valorPendente: 0
  });

  // Estado para opções de filtros
  const [filterOptions, setFilterOptions] = useState({
    periods: [
      { value: 'hoje', label: 'Hoje' },
      { value: 'ontem', label: 'Ontem' },
      { value: 'ultimos7dias', label: 'Últimos 7 dias' },
      { value: 'ultimos30dias', label: 'Últimos 30 dias' },
      { value: 'mesAtual', label: 'Mês atual' },
      { value: 'mesAnterior', label: 'Mês anterior' },
      { value: 'personalizado', label: 'Período personalizado' }
    ],
    fretistas: [],
    placas: [],
    clientes: [],
    redes: [],
    vendedores: [],
    ufs: [],
    status: [],
    situacoes: []
  });

  // Carregar opções de filtros
  useEffect(() => {
    const loadFilterOptions = async () => {
      try {
        const response = await fetch(`${API_URL}/api/dashboard/filter-options`);
        const data = await response.json();

        setFilterOptions(prev => ({
          ...prev,
          fretistas: data.fretistas || [],
          placas: data.placas || [],
          clientes: data.clientes || [],
          redes: data.redes || [],
          vendedores: data.vendedores || [],
          ufs: data.ufs || [],
          status: data.status || [],
          situacoes: data.situacoes || []
        }));
      } catch (error) {
        console.error('Erro ao carregar opções de filtros:', error);
      }
    };

    if (canViewReports) {
      loadFilterOptions();
    }
  }, [canViewReports]);

  // Função para calcular período
  // Carregar dados - APENAS PENDENTE
  const carregarDados = useCallback(async () => {
    if (!canViewReports) return;

    setLoading(true);
    try {
      // Resolver período igual ao Dashboard e Registros
      const resolvePeriod = () => {
        const today = new Date();
        const toISO = (d) => d.toISOString().slice(0, 10);
        const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
        const endOfMonth = (d) => new Date(d.getFullYear(), d.getMonth() + 1, 0);

        switch (filtros.period) {
          case 'hoje': {
            const d = toISO(today);
            return { startDate: d, endDate: d };
          }
          case 'ontem': {
            const y = new Date(today); y.setDate(y.getDate() - 1);
            const d = toISO(y);
            return { startDate: d, endDate: d };
          }
          case 'ultimos7dias': {
            const start = new Date(today); start.setDate(start.getDate() - 6);
            return { startDate: toISO(start), endDate: toISO(today) };
          }
          case 'ultimos30dias': {
            const start = new Date(today); start.setDate(start.getDate() - 29);
            return { startDate: toISO(start), endDate: toISO(today) };
          }
          case 'mesAtual': {
            const s = startOfMonth(today);
            const e = endOfMonth(today);
            return { startDate: toISO(s), endDate: toISO(e) };
          }
          case 'mesAnterior': {
            const prev = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            const s = startOfMonth(prev);
            const e = endOfMonth(prev);
            return { startDate: toISO(s), endDate: toISO(e) };
          }
          case 'personalizado': {
            const start = filtros.dateRange?.start || filtros.dateFrom || '';
            const end = filtros.dateRange?.end || filtros.dateTo || '';
            return { startDate: start, endDate: end };
          }
          default: {
            // SEM FILTRO DE DATA = MOSTRAR TODOS (igual Dashboard e Registros)
            return {
              startDate: filtros.dateFrom || filtros.dateRange?.start || '',
              endDate: filtros.dateTo || filtros.dateRange?.end || ''
            };
          }
        }
      };

      const periodDates = resolvePeriod();
      const effectiveStartDate = filtros.dateFrom || filtros.dateRange?.start || periodDates.startDate;
      const effectiveEndDate = filtros.dateTo || filtros.dateRange?.end || periodDates.endDate;

      // Montar filtros para buscar - IGUAL AO DASHBOARD E REGISTROS
      const filtrosSupabase = {
        dataInicio: effectiveStartDate || '',
        dataFim: effectiveEndDate || '',
        status: 'PENDENTE', // SEMPRE PENDENTE
        fretista: filtros.fretista || '',
        placa: filtros.placa || '',
        cliente: filtros.cliente || '',
        rede: filtros.rede || '',
        vendedor: filtros.vendedor || '',
        uf: filtros.uf || '',
        situacao: filtros.situacao || '',
        busca: filtros.searchText || ''
      };

      const { data: registrosData, error: registrosError } = await getRegistrosWithFilters(filtrosSupabase);
      if (registrosError) {
        console.error('Erro ao carregar registros:', registrosError);
        setRegistros([]);
        setRegistrosPendentes([]);
        return;
      }

      // Filtrar apenas PENDENTE (já vem filtrado, mas garantir)
      const registrosArray = (registrosData || []).filter(r => {
        const st = normalizeStatus(r.status);
        return st === 'PENDENTE';
      });

      // Limitar a 200 registros
      const registrosLimitados = registrosArray.slice(0, maxRegistros);

      setRegistros(registrosArray);
      setRegistrosPendentes(registrosLimitados);

      // Calcular estatísticas apenas de PENDENTE
      const total = registrosArray.length;
      const pendentes = total;
      const valorTotal = registrosArray.reduce((sum, r) => sum + (parseFloat(r.valor_total) || 0), 0);
      const valorPendente = valorTotal;

      setEstatisticas({
        total,
        pendentes,
        valorTotal,
        valorPendente
      });
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      setRegistros([]);
      setRegistrosPendentes([]);
    } finally {
      setLoading(false);
    }
  }, [filtros, canViewReports]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  // Paginação
  const totalPages = Math.ceil(registrosPendentes.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentRegistros = registrosPendentes.slice(startIndex, endIndex);

  const goToPage = (page) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  const goToFirstPage = () => setCurrentPage(1);
  const goToLastPage = () => setCurrentPage(totalPages);
  const goToPrevPage = () => setCurrentPage(prev => Math.max(1, prev - 1));
  const goToNextPage = () => setCurrentPage(prev => Math.min(totalPages, prev + 1));

  useEffect(() => {
    setCurrentPage(1);
  }, [filtros]);

  // Funções de exportação
  const exportarHTML = () => {
    const htmlContent = gerarRelatorioHTML();
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio_pendentes_${format(new Date(), 'yyyy-MM-dd_HHmm', { locale: ptBR })}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportarPDF = async () => {
    try {
      setLoading(true);
      await loadPDFLibraries();
      const htmlContent = gerarRelatorioHTML();
      const printWindow = window.open('', '_blank');
      printWindow.document.write(htmlContent);
      printWindow.document.close();

      await new Promise(resolve => setTimeout(resolve, 2000));

      const { jsPDF } = window.jspdf;
      const { html2canvas } = window;

      const canvas = await html2canvas(printWindow.document.body, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');

      const imgWidth = 210;
      const pageHeight = 297;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`relatorio_pendentes_${format(new Date(), 'yyyy-MM-dd_HHmm', { locale: ptBR })}.pdf`);
      printWindow.close();
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      alert('Erro ao gerar PDF. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const exportarXLSX = async () => {
    try {
      setLoading(true);

      // Preparar filtros para o backend
      const filtrosBackend = {
        dateFrom: filtros.dateFrom || filtros.dateRange?.start || '',
        dateTo: filtros.dateTo || filtros.dateRange?.end || '',
        dataInicio: filtros.dateFrom || filtros.dateRange?.start || '',
        dataFim: filtros.dateTo || filtros.dateRange?.end || '',
        status: 'PENDENTE',
        fretista: filtros.fretista || '',
        placa: filtros.placa || '',
        cliente: filtros.cliente || '',
        rede: filtros.rede || '',
        vendedor: filtros.vendedor || '',
        uf: filtros.uf || '',
        situacao: filtros.situacao || '',
        busca: filtros.searchText || ''
      };

      const response = await fetch(`${API_URL}/api/relatorios/exportar-xlsx`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filtros: filtrosBackend,
          registros: registrosPendentes.length > 0 ? registrosPendentes : []
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Erro na resposta:', response.status, errorText);
        throw new Error(`Erro ao exportar XLSX: ${response.status} - ${errorText}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `relatorio_pendentes_${format(new Date(), 'yyyy-MM-dd_HHmm', { locale: ptBR })}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Erro ao exportar XLSX:', error);
      alert(`Erro ao exportar XLSX: ${error.message || 'Tente novamente.'}`);
    } finally {
      setLoading(false);
    }
  };

  const exportarCSV = () => {
    const headers = ['NF', 'Data Emissão', 'Cliente', 'Fretista', 'Placa', 'Status', 'Valor Total', 'Rede', 'UF', 'Vendedor'];
    const rows = registrosPendentes.map(r => [
      r.numero_nf || '',
      r.data_emissao || '',
      r.nome_fantasia || r.razao_social || '',
      r.fretista || '',
      r.placa || '',
      r.status || '',
      r.valor_total || '0',
      r.rede || '',
      r.uf || '',
      r.vendedor || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio_pendentes_${format(new Date(), 'yyyy-MM-dd_HHmm', { locale: ptBR })}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportarWhatsApp = () => {
    const periodo = filtros.dateFrom && filtros.dateTo
      ? `${format(new Date(filtros.dateFrom), 'dd/MM/yyyy', { locale: ptBR })} a ${format(new Date(filtros.dateTo), 'dd/MM/yyyy', { locale: ptBR })}`
      : 'Período não especificado';

    const mensagem = `📊 *RELATÓRIO DE NOTAS FISCAIS PENDENTES*

📅 *Período:* ${periodo}

📈 *ESTATÍSTICAS:*
• Total de Notas Pendentes: ${estatisticas.pendentes}

💰 *VALORES:*
• Valor Total Pendente: R$ ${estatisticas.valorPendente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}

Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR })}`;

    const url = `https://wa.me/?text=${encodeURIComponent(mensagem)}`;
    window.open(url, '_blank');
  };

  const loadPDFLibraries = async () => {
    if (!window.jspdf) {
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
    }
    if (!window.html2canvas) {
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
    }
  };

  const loadScript = (src) => {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.body.appendChild(script);
    });
  };

  const gerarRelatorioHTML = () => {
    const periodo = filtros.dateFrom && filtros.dateTo
      ? `${format(new Date(filtros.dateFrom), 'dd/MM/yyyy', { locale: ptBR })} a ${format(new Date(filtros.dateTo), 'dd/MM/yyyy', { locale: ptBR })}`
      : filtros.period
        ? filterOptions.periods.find(p => p.value === filtros.period)?.label || filtros.period
        : 'Período não especificado';

    const dataAtual = format(new Date(), "dd/MM/yyyy", { locale: ptBR });
    const tituloRelatorio = `Relatório de Notas Fiscais Pendentes - ${dataAtual}`;

    // Calcular dados para gráficos e tabelas - APENAS PENDENTE
    const pendentes = registrosPendentes;

    // Top Clientes por Valor
    const topClientesChart = pendentes.reduce((acc, curr) => {
      const name = curr.nome_fantasia || curr.razao_social || 'Sem cliente';
      const valor = Number(curr.valor_total) || 0;
      acc[name] = (acc[name] || 0) + valor;
      return acc;
    }, {});
    const topClientesList = Object.entries(topClientesChart)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    // Top Fretistas por Quantidade
    const topFretistasChart = pendentes.reduce((acc, curr) => {
      const fretista = curr.fretista || 'Sem fretista';
      acc[fretista] = (acc[fretista] || 0) + 1;
      return acc;
    }, {});
    const topFretistasList = Object.entries(topFretistasChart)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Top Fretistas por Valor
    const topFretistasValorChart = pendentes.reduce((acc, curr) => {
      const fretista = curr.fretista || 'Sem fretista';
      const valor = Number(curr.valor_total) || 0;
      acc[fretista] = (acc[fretista] || 0) + valor;
      return acc;
    }, {});
    const topFretistasValorList = Object.entries(topFretistasValorChart)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    // Top Redes por Valor
    const topRedesChart = pendentes.reduce((acc, curr) => {
      const rede = curr.rede || 'Sem rede';
      const valor = Number(curr.valor_total) || 0;
      acc[rede] = (acc[rede] || 0) + valor;
      return acc;
    }, {});
    const topRedesList = Object.entries(topRedesChart)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    // Top Vendedores por Valor
    const topVendedoresChart = pendentes.reduce((acc, curr) => {
      const vendedor = curr.vendedor || 'Sem vendedor';
      const valor = Number(curr.valor_total) || 0;
      acc[vendedor] = (acc[vendedor] || 0) + valor;
      return acc;
    }, {});
    const topVendedoresList = Object.entries(topVendedoresChart)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    // Por Data de Emissão
    const porDataChart = pendentes.reduce((acc, curr) => {
      const data = curr.data_emissao ? format(parseLocalDate(curr.data_emissao), 'dd/MM/yyyy', { locale: ptBR }) : 'Sem data';
      const valor = Number(curr.valor_total) || 0;
      if (!acc[data]) {
        acc[data] = { count: 0, valor: 0 };
      }
      acc[data].count++;
      acc[data].valor += valor;
      return acc;
    }, {});
    const porDataList = Object.entries(porDataChart)
      .map(([name, data]) => ({ name, count: data.count, valor: data.valor }))
      .sort((a, b) => {
        const dateA = new Date(a.name.split('/').reverse().join('-'));
        const dateB = new Date(b.name.split('/').reverse().join('-'));
        return dateA - dateB;
      });

    // Por UF
    const porUFChart = pendentes.reduce((acc, curr) => {
      const uf = curr.uf || 'Sem UF';
      const valor = Number(curr.valor_total) || 0;
      if (!acc[uf]) {
        acc[uf] = { count: 0, valor: 0 };
      }
      acc[uf].count++;
      acc[uf].valor += valor;
      return acc;
    }, {});
    const porUFList = Object.entries(porUFChart)
      .map(([name, data]) => ({ name, count: data.count, valor: data.valor }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 10);

    // Calcular insights
    const totalValue = pendentes.reduce((sum, d) => sum + (Number(d.valor_total) || 0), 0);
    const totalPendentes = pendentes.length;
    const insightsList = [];

    if (totalPendentes > 0) {
      insightsList.push(`📊 Total de ${totalPendentes} nota(s) fiscal(is) pendente(s) no período selecionado, totalizando R$ ${totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`);
    }

    if (topClientesList.length > 0 && totalValue > 0) {
      const top1Percent = ((topClientesList[0].value) / totalValue) * 100;
      if (top1Percent > 20) {
        insightsList.push(`⚠️ Cliente "${topClientesList[0].name}" concentra ${top1Percent.toFixed(1)}% do valor total de pendências.`);
      }
    }

    if (topFretistasList.length > 0) {
      insightsList.push(`🚚 Fretista "${topFretistasList[0].name}" lidera em pendências com ${topFretistasList[0].count} nota(s).`);
    }

    if (topVendedoresList.length > 0) {
      insightsList.push(`👤 Vendedor "${topVendedoresList[0].name}" lidera em valor pendente com R$ ${topVendedoresList[0].value.toLocaleString('pt-BR')}.`);
    }

    // Tabelas agrupadas
    const tabelaPorData = porDataList.map(item => ({
      data: item.name,
      quantidade: item.count,
      valor: item.valor
    }));

    const tabelaPorFretista = topFretistasValorList.map(item => ({
      fretista: item.name,
      quantidade: topFretistasChart[item.name] || 0,
      valor: item.value
    }));

    const tabelaPorCliente = topClientesList.map(item => ({
      cliente: item.name,
      quantidade: pendentes.filter(r => (r.nome_fantasia || r.razao_social) === item.name).length,
      valor: item.value
    }));

    const tabelaPorRede = topRedesList.map(item => ({
      rede: item.name,
      quantidade: pendentes.filter(r => r.rede === item.name).length,
      valor: item.value
    }));

    const tabelaPorVendedor = topVendedoresList.map(item => ({
      vendedor: item.name,
      quantidade: pendentes.filter(r => r.vendedor === item.name).length,
      valor: item.value
    }));

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${tituloRelatorio}</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
<style>
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  
  @page {
    size: A4 portrait;
    margin: 15mm;
  }
  
  body {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    background: white;
    padding: 10px;
    color: #333;
    font-size: 9px;
  }
  
  .page {
    page-break-after: auto;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }
  
  .header {
    background: linear-gradient(135deg, #073e29 0%, #0a4d33 100%);
    color: white;
    padding: 12px;
    border-radius: 6px;
    margin-bottom: 12px;
    display: flex;
    align-items: center;
    gap: 15px;
  }
  
  .header-logo {
    width: 50px;
    height: 50px;
    background: white;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  
  .header-logo img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
  
  .header-content {
    flex: 1;
  }
  
  .header h1 {
    font-size: 18px;
    margin-bottom: 4px;
  }
  
  .header-info {
    font-size: 9px;
    opacity: 0.95;
    margin-bottom: 3px;
  }
  
  .header-filters {
    font-size: 8px;
    opacity: 0.85;
    margin-top: 4px;
  }
  
  .kpi-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
    margin-bottom: 12px;
  }
  
  .kpi-card {
    border: 1px solid #ddd;
    border-radius: 6px;
    padding: 8px;
    background: #f9fafb;
  }
  
  .kpi-title {
    font-size: 7px;
    color: #666;
    margin-bottom: 3px;
  }
  
  .kpi-value {
    font-size: 13px;
    font-weight: bold;
    color: #073e29;
  }
  
  .kpi-desc {
    font-size: 6px;
    color: #999;
    margin-top: 2px;
  }
  
  .chart-section {
    margin-bottom: 10px;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  
  .chart-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-bottom: 10px;
  }
  
  .chart-title {
    font-size: 11px;
    font-weight: bold;
    margin-bottom: 6px;
    color: #073e29;
    border-bottom: 2px solid #073e29;
    padding-bottom: 3px;
  }

  .chart-container {
    border: 1px solid #ddd;
    border-radius: 6px;
    padding: 6px;
    background: white;
    height: 140px;
    position: relative;
    width: 100%;
  }
  
  .insights-container {
    border: 1px solid #ddd;
    border-radius: 6px;
    padding: 6px;
    background: white;
    height: 140px;
    position: relative;
    width: 100%;
    overflow-y: auto;
  }
  
  .insight-item {
    font-size: 8px;
    margin-bottom: 4px;
    padding-left: 6px;
    line-height: 1.4;
    color: #333;
  }
  
  .data-table-section {
    margin-top: 12px;
    margin-bottom: 12px;
  }
  
  .data-table-title {
    font-size: 12px;
    font-weight: bold;
    color: #073e29;
    margin-bottom: 8px;
    border-bottom: 2px solid #073e29;
    padding-bottom: 4px;
  }
  
  .data-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 7px;
    margin-bottom: 15px;
    page-break-inside: avoid;
  }
  
  .data-table thead {
    background: #073e29;
    color: white;
  }
  
  .data-table th {
    padding: 6px 4px;
    text-align: left;
    font-weight: bold;
    font-size: 7px;
  }
  
  .data-table td {
    padding: 4px;
    border: 1px solid #ddd;
    color: #333;
  }
  
  .data-table tbody tr:nth-child(even) {
    background: #f9fafb;
  }
  
  .footer {
    margin-top: auto;
    padding-top: 12px;
    border-top: 2px solid #073e29;
    text-align: center;
    font-size: 7px;
    color: #666;
  }
  
  @media print {
    body {
      padding: 0;
    }
    .no-print {
      display: none !important;
    }
    .chart-container, .data-table {
      page-break-inside: avoid;
    }
  }
</style>
</head>
<body>
<button class="no-print" onclick="window.print()" style="position: fixed; top: 10px; right: 10px; z-index: 1000; background: #073e29; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; font-weight: bold;">
  🖨️ Imprimir
</button>

<div class="page">
  <div class="header">
    <div class="header-logo">
      <img src="/logocanhotos.png" alt="Logo" onerror="this.style.display='none'" style="background-color: #073e29;">
    </div>
    <div class="header-content">
      <h1>${tituloRelatorio}</h1>
      <div class="header-info">Relatório Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</div>
      <div class="header-info">Período: ${periodo}</div>
    </div>
  </div>
  
  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="kpi-title">Total Pendentes</div>
      <div class="kpi-value">${estatisticas.pendentes}</div>
      <div class="kpi-desc">Notas Fiscais</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-title">Valor Total</div>
      <div class="kpi-value">R$ ${estatisticas.valorPendente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
      <div class="kpi-desc">Pendente</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-title">Ticket Médio</div>
      <div class="kpi-value">R$ ${estatisticas.pendentes > 0 ? (estatisticas.valorPendente / estatisticas.pendentes).toLocaleString('pt-BR', { maximumFractionDigits: 0 }) : '0'}</div>
      <div class="kpi-desc">Por nota</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-title">Top Cliente</div>
      <div class="kpi-value">${topClientesList.length > 0 ? topClientesList[0].name.substring(0, 15) : '-'}</div>
      <div class="kpi-desc">R$ ${topClientesList.length > 0 ? topClientesList[0].value.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '0'}</div>
    </div>
  </div>
  
  <!-- Seção 1: Evolução no Tempo | Top Clientes -->
  <div class="chart-grid">
    <div class="chart-section">
      <div class="chart-title">Evolução no Tempo</div>
      <div class="chart-container">
        <canvas id="chartEvolucao"></canvas>
      </div>
    </div>
    <div class="chart-section">
      <div class="chart-title">Top Clientes (Valor)</div>
      <div class="chart-container">
        <canvas id="chartTopClientes"></canvas>
      </div>
    </div>
  </div>
  
  <!-- Seção 2: Top Fretistas | Top Redes -->
  <div class="chart-grid">
    <div class="chart-section">
      <div class="chart-title">Top Fretistas (Quantidade)</div>
      <div class="chart-container">
        <canvas id="chartFretistas"></canvas>
      </div>
    </div>
    <div class="chart-section">
      <div class="chart-title">Top Redes (Valor)</div>
      <div class="chart-container">
        <canvas id="chartRedes"></canvas>
      </div>
    </div>
  </div>
  
  <!-- Seção 3: Top Vendedores | Distribuição por UF -->
  <div class="chart-grid">
    <div class="chart-section">
      <div class="chart-title">Top Vendedores (Valor)</div>
      <div class="chart-container">
        <canvas id="chartVendedores"></canvas>
      </div>
    </div>
    <div class="chart-section">
      <div class="chart-title">Distribuição por UF</div>
      <div class="chart-container">
        <canvas id="chartUF"></canvas>
      </div>
    </div>
  </div>
  
  <!-- Seção 4: Insights Automáticos -->
  ${insightsList.length > 0 ? `
  <div class="chart-section">
    <div class="chart-title">Insights Automáticos</div>
    <div class="insights-container">
      ${insightsList.map((insight) => `
        <div class="insight-item">${insight}</div>
      `).join('')}
    </div>
  </div>
  ` : ''}
  
  <!-- Tabelas de Dados -->
  <div class="data-table-section">
    ${tabelaPorData.length > 0 ? `
      <div class="data-table-title">Por Data de Emissão (${tabelaPorData.length})</div>
      <table class="data-table">
        <thead>
          <tr>
            <th>Data Emissão</th>
            <th>Quantidade</th>
            <th>Valor Total</th>
          </tr>
        </thead>
        <tbody>
          ${tabelaPorData.map(item => `
            <tr>
              <td>${item.data}</td>
              <td>${item.quantidade}</td>
              <td>R$ ${item.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    ` : ''}

    ${tabelaPorFretista.length > 0 ? `
      <div class="data-table-title">Por Fretista (${tabelaPorFretista.length})</div>
      <table class="data-table">
        <thead>
          <tr>
            <th>Fretista</th>
            <th>Quantidade</th>
            <th>Valor Total</th>
          </tr>
        </thead>
        <tbody>
          ${tabelaPorFretista.map(item => `
            <tr>
              <td>${item.fretista}</td>
              <td>${item.quantidade}</td>
              <td>R$ ${item.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    ` : ''}

    ${tabelaPorCliente.length > 0 ? `
      <div class="data-table-title">Por Cliente (${tabelaPorCliente.length})</div>
      <table class="data-table">
        <thead>
          <tr>
            <th>Cliente</th>
            <th>Quantidade</th>
            <th>Valor Total</th>
          </tr>
        </thead>
        <tbody>
          ${tabelaPorCliente.map(item => `
            <tr>
              <td>${item.cliente.substring(0, 40)}</td>
              <td>${item.quantidade}</td>
              <td>R$ ${item.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    ` : ''}

    ${tabelaPorRede.length > 0 ? `
      <div class="data-table-title">Por Rede (${tabelaPorRede.length})</div>
      <table class="data-table">
        <thead>
          <tr>
            <th>Rede</th>
            <th>Quantidade</th>
            <th>Valor Total</th>
          </tr>
        </thead>
        <tbody>
          ${tabelaPorRede.map(item => `
            <tr>
              <td>${item.rede}</td>
              <td>${item.quantidade}</td>
              <td>R$ ${item.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    ` : ''}

    ${tabelaPorVendedor.length > 0 ? `
      <div class="data-table-title">Por Vendedor (${tabelaPorVendedor.length})</div>
      <table class="data-table">
        <thead>
          <tr>
            <th>Vendedor</th>
            <th>Quantidade</th>
            <th>Valor Total</th>
          </tr>
        </thead>
        <tbody>
          ${tabelaPorVendedor.map(item => `
            <tr>
              <td>${item.vendedor}</td>
              <td>${item.quantidade}</td>
              <td>R$ ${item.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    ` : ''}

    ${pendentes.length > 0 ? `
      <div class="data-table-title">Registros Detalhados (${pendentes.length})</div>
      <table class="data-table">
        <thead>
          <tr>
            <th>NF</th>
            <th>Data Emissão</th>
            <th>Cliente</th>
            <th>Fretista</th>
            <th>Placa</th>
            <th>Rede</th>
            <th>UF</th>
            <th>Vendedor</th>
            <th>Valor Total</th>
          </tr>
        </thead>
        <tbody>
          ${pendentes.slice(0, 100).map(item => `
            <tr>
              <td><strong>${item.numero_nf || '-'}</strong></td>
              <td>${item.data_emissao ? format(parseLocalDate(item.data_emissao), 'dd/MM/yyyy', { locale: ptBR }) : '-'}</td>
              <td>${(item.nome_fantasia || item.razao_social || '-').substring(0, 25)}</td>
              <td>${item.fretista || '-'}</td>
              <td>${item.placa || '-'}</td>
              <td>${item.rede || '-'}</td>
              <td>${item.uf || '-'}</td>
              <td>${item.vendedor || '-'}</td>
              <td><strong>R$ ${(Number(item.valor_total) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    ` : ''}
  </div>
  
  <div class="footer">
    <p>Relatório gerado automaticamente pelo Sistema CHECKNF - GDM</p>
    <p>Data de geração: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}</p>
  </div>
</div>

<script>
  Chart.defaults.font.size = 8;
  Chart.defaults.color = '#1f2937';
  Chart.defaults.borderColor = '#e5e7eb';
  
  const commonChartOptions = {
    responsive: false,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#fff',
        bodyColor: '#fff',
        borderColor: '#17432a',
        borderWidth: 1
      }
    },
    scales: {
      x: {
        grid: { color: '#e5e7eb' },
        ticks: { color: '#1f2937', font: { size: 8 } }
      },
      y: {
        grid: { color: '#e5e7eb' },
        ticks: { color: '#1f2937', font: { size: 8 } }
      }
    }
  };
  
  // Gráfico de Evolução no Tempo
  const evolucaoData = ${JSON.stringify(porDataList.map(d => ({ name: d.name, value: d.valor, count: d.count })))};
  new Chart(document.getElementById('chartEvolucao'), {
    type: 'line',
    data: {
      labels: evolucaoData.map(d => d.name),
      datasets: [{
        label: 'Valor Total (R$)',
        data: evolucaoData.map(d => d.value),
        borderColor: '#17432a',
        backgroundColor: 'rgba(23, 67, 42, 0.15)',
        borderWidth: 2,
        fill: true,
        tension: 0.4
      }]
    },
    options: {
      ...commonChartOptions,
      plugins: {
        ...commonChartOptions.plugins,
        legend: { display: true, position: 'bottom', labels: { color: '#1f2937' } },
        tooltip: {
          ...commonChartOptions.plugins.tooltip,
          callbacks: {
            label: (context) => 'R$ ' + context.parsed.y.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
          }
        }
      },
      scales: {
        ...commonChartOptions.scales,
        y: {
          ...commonChartOptions.scales.y,
          beginAtZero: true,
          ticks: {
            ...commonChartOptions.scales.y.ticks,
            callback: (value) => 'R$ ' + value.toLocaleString('pt-BR', { maximumFractionDigits: 0 })
          }
        },
        x: {
          ...commonChartOptions.scales.x,
          ticks: {
            ...commonChartOptions.scales.x.ticks,
            maxRotation: 45,
            minRotation: 45
          }
        }
      }
    }
  });
  
  // Gráfico Top Clientes
  new Chart(document.getElementById('chartTopClientes'), {
    type: 'bar',
    data: {
      labels: ${JSON.stringify(topClientesList.map(d => d.name.length > 12 ? d.name.substring(0, 12) + '...' : d.name))},
      datasets: [{
        label: 'Valor (R$)',
        data: ${JSON.stringify(topClientesList.map(d => d.value))},
        backgroundColor: '#17432a',
        borderColor: '#0a4d33',
        borderWidth: 1
      }]
    },
    options: {
      ...commonChartOptions,
      indexAxis: 'y',
      scales: {
        ...commonChartOptions.scales,
        x: {
          ...commonChartOptions.scales.x,
          ticks: {
            ...commonChartOptions.scales.x.ticks,
            callback: (value) => 'R$ ' + value.toLocaleString('pt-BR', { maximumFractionDigits: 0 })
          }
        }
      },
      plugins: {
        ...commonChartOptions.plugins,
        tooltip: {
          ...commonChartOptions.plugins.tooltip,
          callbacks: {
            label: (context) => 'R$ ' + context.parsed.x.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
          }
        }
      }
    }
  });
  
  // Gráfico Top Fretistas
  new Chart(document.getElementById('chartFretistas'), {
    type: 'bar',
    data: {
      labels: ${JSON.stringify(topFretistasList.map(d => d.name.length > 12 ? d.name.substring(0, 12) + '...' : d.name))},
      datasets: [{
        label: 'Quantidade',
        data: ${JSON.stringify(topFretistasList.map(d => d.count))},
        backgroundColor: '#0a4d33',
        borderColor: '#17432a',
        borderWidth: 1
      }]
    },
    options: {
      ...commonChartOptions,
      scales: {
        ...commonChartOptions.scales,
        y: {
          ...commonChartOptions.scales.y,
          beginAtZero: true,
          ticks: {
            ...commonChartOptions.scales.y.ticks,
            stepSize: 1
          }
        },
        x: {
          ...commonChartOptions.scales.x,
          ticks: {
            ...commonChartOptions.scales.x.ticks,
            maxRotation: 45,
            minRotation: 45
          }
        }
      },
      plugins: {
        ...commonChartOptions.plugins,
        tooltip: {
          ...commonChartOptions.plugins.tooltip,
          callbacks: {
            label: (context) => context.parsed.y + ' nota(s)'
          }
        }
      }
    }
  });
  
  // Gráfico Top Redes
  new Chart(document.getElementById('chartRedes'), {
    type: 'bar',
    data: {
      labels: ${JSON.stringify(topRedesList.map(d => d.name.length > 12 ? d.name.substring(0, 12) + '...' : d.name))},
      datasets: [{
        label: 'Valor (R$)',
        data: ${JSON.stringify(topRedesList.map(d => d.value))},
        backgroundColor: '#065f46',
        borderColor: '#0a4d33',
        borderWidth: 1
      }]
    },
    options: {
      ...commonChartOptions,
      scales: {
        ...commonChartOptions.scales,
        y: {
          ...commonChartOptions.scales.y,
          beginAtZero: true,
          ticks: {
            ...commonChartOptions.scales.y.ticks,
            callback: (value) => 'R$ ' + value.toLocaleString('pt-BR', { maximumFractionDigits: 0 })
          }
        },
        x: {
          ...commonChartOptions.scales.x,
          ticks: {
            ...commonChartOptions.scales.x.ticks,
            maxRotation: 45,
            minRotation: 45
          }
        }
      },
      plugins: {
        ...commonChartOptions.plugins,
        tooltip: {
          ...commonChartOptions.plugins.tooltip,
          callbacks: {
            label: (context) => 'R$ ' + context.parsed.y.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
          }
        }
      }
    }
  });
  
  // Gráfico Top Vendedores
  new Chart(document.getElementById('chartVendedores'), {
    type: 'bar',
    data: {
      labels: ${JSON.stringify(topVendedoresList.map(d => d.name.length > 12 ? d.name.substring(0, 12) + '...' : d.name))},
      datasets: [{
        label: 'Valor (R$)',
        data: ${JSON.stringify(topVendedoresList.map(d => d.value))},
        backgroundColor: '#0a4d33',
        borderColor: '#17432a',
        borderWidth: 1
      }]
    },
    options: {
      ...commonChartOptions,
      scales: {
        ...commonChartOptions.scales,
        y: {
          ...commonChartOptions.scales.y,
          beginAtZero: true,
          ticks: {
            ...commonChartOptions.scales.y.ticks,
            callback: (value) => 'R$ ' + value.toLocaleString('pt-BR', { maximumFractionDigits: 0 })
          }
        },
        x: {
          ...commonChartOptions.scales.x,
          ticks: {
            ...commonChartOptions.scales.x.ticks,
            maxRotation: 45,
            minRotation: 45
          }
        }
      },
      plugins: {
        ...commonChartOptions.plugins,
        tooltip: {
          ...commonChartOptions.plugins.tooltip,
          callbacks: {
            label: (context) => 'R$ ' + context.parsed.y.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
          }
        }
      }
    }
  });
  
  // Gráfico por UF
  new Chart(document.getElementById('chartUF'), {
    type: 'bar',
    data: {
      labels: ${JSON.stringify(porUFList.map(d => d.name))},
      datasets: [{
        label: 'Valor (R$)',
        data: ${JSON.stringify(porUFList.map(d => d.valor))},
        backgroundColor: '#17432a',
        borderColor: '#0a4d33',
        borderWidth: 1
      }]
    },
    options: {
      ...commonChartOptions,
      indexAxis: 'y',
      scales: {
        ...commonChartOptions.scales,
        x: {
          ...commonChartOptions.scales.x,
          ticks: {
            ...commonChartOptions.scales.x.ticks,
            callback: (value) => 'R$ ' + value.toLocaleString('pt-BR', { maximumFractionDigits: 0 })
          }
        }
      },
      plugins: {
        ...commonChartOptions.plugins,
        tooltip: {
          ...commonChartOptions.plugins.tooltip,
          callbacks: {
            label: (context) => 'R$ ' + context.parsed.x.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
          }
        }
      }
    }
  });
</script>
</body>
</html>`;
  };

  if (!canViewReports) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card>
          <CardHeader>
            <CardTitle>Acesso Negado</CardTitle>
            <CardDescription>Você não tem permissão para acessar esta página.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <PageHeader
        title="Relatórios"
        description="Análise completa de notas fiscais pendentes e exportação de dados"
      />

      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Filtros Completos */}
        <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Filter className="w-5 h-5" />
                <CardTitle>Filtros</CardTitle>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
              >
                {showFilters ? <X className="w-4 h-4" /> : <Filter className="w-4 h-4" />}
              </Button>
            </div>
          </CardHeader>
          {showFilters && (
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Período</label>
                  <Select
                    value={filtros.period || 'all'}
                    onValueChange={(value) => setFiltros({ ...filtros, period: value === 'all' ? '' : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o período" />
                    </SelectTrigger>
                    <SelectContent>
                      {filterOptions.periods.map(p => (
                        <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Data Início</label>
                  <Input
                    type="date"
                    value={filtros.dateFrom || filtros.dateRange?.start || ''}
                    onChange={(e) => setFiltros({
                      ...filtros,
                      dateFrom: e.target.value,
                      dateRange: { ...filtros.dateRange, start: e.target.value }
                    })}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Data Fim</label>
                  <Input
                    type="date"
                    value={filtros.dateTo || filtros.dateRange?.end || ''}
                    onChange={(e) => setFiltros({
                      ...filtros,
                      dateTo: e.target.value,
                      dateRange: { ...filtros.dateRange, end: e.target.value }
                    })}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Fretista</label>
                  <Select
                    value={filtros.fretista || 'all'}
                    onValueChange={(value) => setFiltros({ ...filtros, fretista: value === 'all' ? '' : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      {filterOptions.fretistas.filter(f => f).map(f => (
                        <SelectItem key={f} value={f}>{f}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Placa</label>
                  <Select
                    value={filtros.placa || 'all'}
                    onValueChange={(value) => setFiltros({ ...filtros, placa: value === 'all' ? '' : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent>
                      {filterOptions.placas.filter(p => p).map(p => (
                        <SelectItem key={p} value={p}>{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Cliente</label>
                  <Select
                    value={filtros.cliente || 'all'}
                    onValueChange={(value) => setFiltros({ ...filtros, cliente: value === 'all' ? '' : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      {filterOptions.clientes.filter(c => c).map(c => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Rede</label>
                  <Select
                    value={filtros.rede || 'all'}
                    onValueChange={(value) => setFiltros({ ...filtros, rede: value === 'all' ? '' : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent>
                      {filterOptions.redes.filter(r => r).map(r => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Vendedor</label>
                  <Select
                    value={filtros.vendedor || 'all'}
                    onValueChange={(value) => setFiltros({ ...filtros, vendedor: value === 'all' ? '' : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      {filterOptions.vendedores.filter(v => v).map(v => (
                        <SelectItem key={v} value={v}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">UF</label>
                  <Select
                    value={filtros.uf || 'all'}
                    onValueChange={(value) => setFiltros({ ...filtros, uf: value === 'all' ? '' : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent>
                      {filterOptions.ufs.filter(u => u).map(u => (
                        <SelectItem key={u} value={u}>{u}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Situação</label>
                  <Select
                    value={filtros.situacao || 'all'}
                    onValueChange={(value) => setFiltros({ ...filtros, situacao: value === 'all' ? '' : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent>
                      {filterOptions.situacoes.filter(s => s).map(s => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="md:col-span-2 lg:col-span-3">
                  <label className="text-sm font-medium mb-2 block">Busca</label>
                  <Input
                    placeholder="Buscar por NF, cliente, fretista, placa..."
                    value={filtros.searchText}
                    onChange={(e) => setFiltros({ ...filtros, searchText: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex gap-2 mt-4">
                <Button onClick={carregarDados} disabled={loading}>
                  <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                  Aplicar Filtros
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setFiltros({
                      dateFrom: '',
                      dateTo: '',
                      period: '',
                      fretista: '',
                      placa: '',
                      cliente: '',
                      rede: '',
                      vendedor: '',
                      uf: '',
                      situacao: '',
                      searchText: '',
                      dateRange: { start: '', end: '' }
                    });
                    setCurrentPage(1);
                  }}
                >
                  Limpar
                </Button>
              </div>
            </CardContent>
          )}
        </Card>

        {/* Cards de Estatísticas - APENAS PENDENTE */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="shadow-lg border-l-4 border-l-yellow-500">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Pendentes</p>
                  <p className="text-3xl font-bold text-yellow-600">{estatisticas.pendentes}</p>
                  <p className="text-xs text-muted-foreground mt-1">Notas Fiscais</p>
                </div>
                <Clock className="w-12 h-12 text-yellow-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-lg border-l-4 border-l-orange-500">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Valor Total Pendente</p>
                  <p className="text-2xl font-bold text-orange-600">
                    R$ {estatisticas.valorPendente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <DollarSign className="w-10 h-10 text-orange-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-lg border-l-4 border-l-blue-500">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Ticket Médio</p>
                  <p className="text-2xl font-bold text-blue-600">
                    R$ {estatisticas.pendentes > 0 ? (estatisticas.valorPendente / estatisticas.pendentes).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '0,00'}
                  </p>
                </div>
                <TrendingUp className="w-10 h-10 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-lg border-l-4 border-l-purple-500">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Registros Exibidos</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {registrosPendentes.length} / {maxRegistros}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Máximo permitido</p>
                </div>
                <Package className="w-10 h-10 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Botões de Exportação */}
        <Card className="shadow-lg border-0 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="w-5 h-5" />
              Exportar Relatórios
            </CardTitle>
            <CardDescription>
              Exporte os dados em diferentes formatos para análise externa
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <Button
                onClick={exportarHTML}
                className="bg-blue-600 hover:bg-blue-700 text-white"
                disabled={loading}
              >
                <FileCode className="w-4 h-4 mr-2" />
                HTML
              </Button>

              <Button
                onClick={exportarPDF}
                className="bg-red-600 hover:bg-red-700 text-white"
                disabled={loading}
              >
                <FileText className="w-4 h-4 mr-2" />
                PDF
              </Button>

              <Button
                onClick={exportarXLSX}
                className="bg-green-600 hover:bg-green-700 text-white"
                disabled={loading}
              >
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                XLSX
              </Button>

              <Button
                onClick={exportarCSV}
                className="bg-purple-600 hover:bg-purple-700 text-white"
                disabled={loading}
              >
                <FileBarChart className="w-4 h-4 mr-2" />
                CSV
              </Button>

              <Button
                onClick={exportarWhatsApp}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                disabled={loading}
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                WhatsApp
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Gráficos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Top 10 Clientes (Valor Pendente)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                {(() => {
                  const topClientes = registrosPendentes.reduce((acc, r) => {
                    const cliente = r.nome_fantasia || r.razao_social || 'Sem cliente';
                    acc[cliente] = (acc[cliente] || 0) + (parseFloat(r.valor_total) || 0);
                    return acc;
                  }, {});
                  const topClientesList = Object.entries(topClientes)
                    .map(([name, value]) => ({ name, value }))
                    .sort((a, b) => b.value - a.value)
                    .slice(0, 10);

                  return (
                    <Bar
                      data={{
                        labels: topClientesList.map(c => c.name.substring(0, 20)),
                        datasets: [{
                          label: 'Valor (R$)',
                          data: topClientesList.map(c => c.value),
                          backgroundColor: '#073e29'
                        }]
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        indexAxis: 'y',
                        plugins: {
                          legend: {
                            display: false
                          }
                        },
                        scales: {
                          x: {
                            ticks: {
                              callback: function (value) {
                                return 'R$ ' + value.toLocaleString('pt-BR');
                              }
                            }
                          }
                        }
                      }}
                    />
                  );
                })()}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Top 10 Fretistas (Quantidade)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                {(() => {
                  const topFretistas = registrosPendentes.reduce((acc, r) => {
                    const fretista = r.fretista || 'Sem fretista';
                    acc[fretista] = (acc[fretista] || 0) + 1;
                    return acc;
                  }, {});
                  const topFretistasList = Object.entries(topFretistas)
                    .map(([name, count]) => ({ name, count }))
                    .sort((a, b) => b.count - a.count)
                    .slice(0, 10);

                  return (
                    <Bar
                      data={{
                        labels: topFretistasList.map(f => f.name.substring(0, 20)),
                        datasets: [{
                          label: 'Quantidade',
                          data: topFretistasList.map(f => f.count),
                          backgroundColor: '#0a4d33'
                        }]
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: {
                            display: false
                          }
                        },
                        scales: {
                          y: {
                            beginAtZero: true,
                            ticks: {
                              stepSize: 1
                            }
                          }
                        }
                      }}
                    />
                  );
                })()}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabela de Dados com Paginação */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Registros Pendentes ({estatisticas.pendentes})</CardTitle>
            <CardDescription>
              Lista de notas fiscais pendentes conforme filtros aplicados
              {registrosPendentes.length >= maxRegistros && (
                <span className="text-yellow-600 font-semibold ml-2">
                  (Limitado a {maxRegistros} registros na exibição)
                </span>
              )}
              {!filtros.dateFrom && !filtros.dateTo && !filtros.period && (
                <span className="text-blue-600 font-semibold ml-2">
                  (Mostrando todos os registros - sem filtro de data)
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-slate-100">
                    <th className="text-left p-3 font-semibold">NF</th>
                    <th className="text-left p-3 font-semibold">Data Emissão</th>
                    <th className="text-left p-3 font-semibold">Cliente</th>
                    <th className="text-left p-3 font-semibold">Fretista</th>
                    <th className="text-left p-3 font-semibold">Placa</th>
                    <th className="text-left p-3 font-semibold">Rede</th>
                    <th className="text-left p-3 font-semibold">UF</th>
                    <th className="text-left p-3 font-semibold">Vendedor</th>
                    <th className="text-right p-3 font-semibold">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {currentRegistros.map((r, idx) => (
                    <tr key={idx} className="border-b hover:bg-slate-50">
                      <td className="p-3 font-medium">{r.numero_nf || '-'}</td>
                      <td className="p-3">
                        {r.data_emissao ? format(parseLocalDate(r.data_emissao), 'dd/MM/yyyy', { locale: ptBR }) : '-'}
                      </td>
                      <td className="p-3">{(r.nome_fantasia || r.razao_social || '-').substring(0, 30)}</td>
                      <td className="p-3">{r.fretista || '-'}</td>
                      <td className="p-3">{r.placa || '-'}</td>
                      <td className="p-3">{r.rede || '-'}</td>
                      <td className="p-3">{r.uf || '-'}</td>
                      <td className="p-3">{r.vendedor || '-'}</td>
                      <td className="p-3 text-right font-medium">
                        R$ {(parseFloat(r.valor_total) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Paginação */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-muted-foreground">
                  Mostrando {startIndex + 1} a {Math.min(endIndex, registrosPendentes.length)} de {registrosPendentes.length} registros
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={goToFirstPage}
                    disabled={currentPage === 1}
                  >
                    <ChevronsLeft className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={goToPrevPage}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <div className="text-sm font-medium">
                    Página {currentPage} de {totalPages}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={goToNextPage}
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={goToLastPage}
                    disabled={currentPage === totalPages}
                  >
                    <ChevronsRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}

            {registrosPendentes.length === 0 && !loading && (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum registro pendente encontrado com os filtros aplicados.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Relatorios;
