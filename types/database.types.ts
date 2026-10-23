export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      caja_movimientos: {
        Row: {
          concepto: string
          created_at: string
          id: string
          monto: number
          registrado_por: string
          sesion_id: string
          tipo: Database["public"]["Enums"]["tipo_movimiento_caja"]
        }
        Insert: {
          concepto: string
          created_at?: string
          id?: string
          monto: number
          registrado_por: string
          sesion_id: string
          tipo: Database["public"]["Enums"]["tipo_movimiento_caja"]
        }
        Update: {
          concepto?: string
          created_at?: string
          id?: string
          monto?: number
          registrado_por?: string
          sesion_id?: string
          tipo?: Database["public"]["Enums"]["tipo_movimiento_caja"]
        }
        Relationships: [
          {
            foreignKeyName: "caja_movimientos_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caja_movimientos_sesion_id_fkey"
            columns: ["sesion_id"]
            isOneToOne: false
            referencedRelation: "cajas_sesiones"
            referencedColumns: ["id"]
          },
        ]
      }
      cajas_sesiones: {
        Row: {
          abierta_por: string
          cerrada_por: string | null
          efectivo_contado: number | null
          efectivo_esperado: number | null
          fecha_apertura: string
          fecha_cierre: string | null
          fondo_inicial: number
          id: string
          notas_cierre: string | null
          tarjeta_contado: number | null
          tarjeta_esperado: number | null
          transferencia_contado: number | null
          transferencia_esperado: number | null
          ubicacion_id: string
        }
        Insert: {
          abierta_por: string
          cerrada_por?: string | null
          efectivo_contado?: number | null
          efectivo_esperado?: number | null
          fecha_apertura?: string
          fecha_cierre?: string | null
          fondo_inicial?: number
          id?: string
          notas_cierre?: string | null
          tarjeta_contado?: number | null
          tarjeta_esperado?: number | null
          transferencia_contado?: number | null
          transferencia_esperado?: number | null
          ubicacion_id: string
        }
        Update: {
          abierta_por?: string
          cerrada_por?: string | null
          efectivo_contado?: number | null
          efectivo_esperado?: number | null
          fecha_apertura?: string
          fecha_cierre?: string | null
          fondo_inicial?: number
          id?: string
          notas_cierre?: string | null
          tarjeta_contado?: number | null
          tarjeta_esperado?: number | null
          transferencia_contado?: number | null
          transferencia_esperado?: number | null
          ubicacion_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cajas_sesiones_abierta_por_fkey"
            columns: ["abierta_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cajas_sesiones_cerrada_por_fkey"
            columns: ["cerrada_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cajas_sesiones_ubicacion_id_fkey"
            columns: ["ubicacion_id"]
            isOneToOne: false
            referencedRelation: "ubicaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes: {
        Row: {
          contacto_nombre: string | null
          created_at: string
          direccion: string | null
          email: string | null
          id: string
          nombre_comercial: string
          notas: string | null
          razon_social: string | null
          rfc: string | null
          telefono: string | null
        }
        Insert: {
          contacto_nombre?: string | null
          created_at?: string
          direccion?: string | null
          email?: string | null
          id?: string
          nombre_comercial: string
          notas?: string | null
          razon_social?: string | null
          rfc?: string | null
          telefono?: string | null
        }
        Update: {
          contacto_nombre?: string | null
          created_at?: string
          direccion?: string | null
          email?: string | null
          id?: string
          nombre_comercial?: string
          notas?: string | null
          razon_social?: string | null
          rfc?: string | null
          telefono?: string | null
        }
        Relationships: []
      }
      colaborador_etapas: {
        Row: {
          etapa_id: string
          id: string
          perfil_id: string
        }
        Insert: {
          etapa_id: string
          id?: string
          perfil_id: string
        }
        Update: {
          etapa_id?: string
          id?: string
          perfil_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "colaborador_etapas_etapa_id_fkey"
            columns: ["etapa_id"]
            isOneToOne: false
            referencedRelation: "etapas_proceso"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "colaborador_etapas_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      compra_items: {
        Row: {
          cantidad: number
          compra_id: string
          costo_unitario: number
          id: string
          material_id: string
          subtotal: number | null
        }
        Insert: {
          cantidad: number
          compra_id: string
          costo_unitario: number
          id?: string
          material_id: string
          subtotal?: number | null
        }
        Update: {
          cantidad?: number
          compra_id?: string
          costo_unitario?: number
          id?: string
          material_id?: string
          subtotal?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "compra_items_compra_id_fkey"
            columns: ["compra_id"]
            isOneToOne: false
            referencedRelation: "compras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compra_items_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materiales"
            referencedColumns: ["id"]
          },
        ]
      }
      compras: {
        Row: {
          created_at: string
          fecha: string
          folio: string
          id: string
          notas: string | null
          proveedor: string
          registrado_por: string | null
          total: number
        }
        Insert: {
          created_at?: string
          fecha?: string
          folio: string
          id?: string
          notas?: string | null
          proveedor: string
          registrado_por?: string | null
          total?: number
        }
        Update: {
          created_at?: string
          fecha?: string
          folio?: string
          id?: string
          notas?: string | null
          proveedor?: string
          registrado_por?: string | null
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "compras_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      consumo_material_orden: {
        Row: {
          cantidad_estimada: number | null
          cantidad_real: number
          cantidad_real_registrada_en: string | null
          created_at: string
          id: string
          lote_id: string
          material_id: string
        }
        Insert: {
          cantidad_estimada?: number | null
          cantidad_real?: number
          cantidad_real_registrada_en?: string | null
          created_at?: string
          id?: string
          lote_id: string
          material_id: string
        }
        Update: {
          cantidad_estimada?: number | null
          cantidad_real?: number
          cantidad_real_registrada_en?: string | null
          created_at?: string
          id?: string
          lote_id?: string
          material_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "consumo_material_orden_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "lotes_produccion"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consumo_material_orden_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materiales"
            referencedColumns: ["id"]
          },
        ]
      }
      consumo_unidad_orden: {
        Row: {
          cantidad_estimada: number | null
          cantidad_real: number | null
          cantidad_real_registrada_en: string | null
          created_at: string
          id: string
          lote_id: string
          unidad_id: string
        }
        Insert: {
          cantidad_estimada?: number | null
          cantidad_real?: number | null
          cantidad_real_registrada_en?: string | null
          created_at?: string
          id?: string
          lote_id: string
          unidad_id: string
        }
        Update: {
          cantidad_estimada?: number | null
          cantidad_real?: number | null
          cantidad_real_registrada_en?: string | null
          created_at?: string
          id?: string
          lote_id?: string
          unidad_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "consumo_unidad_orden_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "lotes_produccion"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consumo_unidad_orden_unidad_id_fkey"
            columns: ["unidad_id"]
            isOneToOne: false
            referencedRelation: "unidades_material"
            referencedColumns: ["id"]
          },
        ]
      }
      detalles_bordado: {
        Row: {
          created_at: string
          descripcion: string
          id: string
          prenda_id: string
          tipo: string
          ubicacion: string
        }
        Insert: {
          created_at?: string
          descripcion: string
          id?: string
          prenda_id: string
          tipo: string
          ubicacion: string
        }
        Update: {
          created_at?: string
          descripcion?: string
          id?: string
          prenda_id?: string
          tipo?: string
          ubicacion?: string
        }
        Relationships: [
          {
            foreignKeyName: "detalles_bordado_prenda_id_fkey"
            columns: ["prenda_id"]
            isOneToOne: false
            referencedRelation: "prendas_bordado"
            referencedColumns: ["id"]
          },
        ]
      }
      entregas: {
        Row: {
          created_at: string
          estatus: Database["public"]["Enums"]["estatus_entrega"]
          fecha_programada: string
          fecha_real: string | null
          firma_url: string | null
          id: string
          notas: string | null
          pedido_id: string
          recibido_por: string | null
          registrado_por: string | null
        }
        Insert: {
          created_at?: string
          estatus?: Database["public"]["Enums"]["estatus_entrega"]
          fecha_programada: string
          fecha_real?: string | null
          firma_url?: string | null
          id?: string
          notas?: string | null
          pedido_id: string
          recibido_por?: string | null
          registrado_por?: string | null
        }
        Update: {
          created_at?: string
          estatus?: Database["public"]["Enums"]["estatus_entrega"]
          fecha_programada?: string
          fecha_real?: string | null
          firma_url?: string | null
          id?: string
          notas?: string | null
          pedido_id?: string
          recibido_por?: string | null
          registrado_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "entregas_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entregas_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      etapas_proceso: {
        Row: {
          activo: boolean
          descripcion: string | null
          id: string
          nombre: string
        }
        Insert: {
          activo?: boolean
          descripcion?: string | null
          id?: string
          nombre: string
        }
        Update: {
          activo?: boolean
          descripcion?: string | null
          id?: string
          nombre?: string
        }
        Relationships: []
      }
      gastos: {
        Row: {
          categoria: string
          concepto: string
          created_at: string
          fecha: string
          id: string
          monto: number
          notas: string | null
          registrado_por: string | null
        }
        Insert: {
          categoria: string
          concepto: string
          created_at?: string
          fecha?: string
          id?: string
          monto: number
          notas?: string | null
          registrado_por?: string | null
        }
        Update: {
          categoria?: string
          concepto?: string
          created_at?: string
          fecha?: string
          id?: string
          monto?: number
          notas?: string | null
          registrado_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gastos_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      incidencias_produccion: {
        Row: {
          created_at: string
          descripcion: string
          foto_url: string | null
          gravedad: string
          id: string
          lote_etapa_id: string | null
          lote_id: string
          reportado_por: string | null
          resuelto: boolean
        }
        Insert: {
          created_at?: string
          descripcion: string
          foto_url?: string | null
          gravedad?: string
          id?: string
          lote_etapa_id?: string | null
          lote_id: string
          reportado_por?: string | null
          resuelto?: boolean
        }
        Update: {
          created_at?: string
          descripcion?: string
          foto_url?: string | null
          gravedad?: string
          id?: string
          lote_etapa_id?: string | null
          lote_id?: string
          reportado_por?: string | null
          resuelto?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "incidencias_produccion_lote_etapa_id_fkey"
            columns: ["lote_etapa_id"]
            isOneToOne: false
            referencedRelation: "lote_etapas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidencias_produccion_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "lotes_produccion"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidencias_produccion_reportado_por_fkey"
            columns: ["reportado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      intentos_login: {
        Row: {
          actualizado_at: string
          bloqueado_hasta: string | null
          identificador: string
          intentos: number
        }
        Insert: {
          actualizado_at?: string
          bloqueado_hasta?: string | null
          identificador: string
          intentos?: number
        }
        Update: {
          actualizado_at?: string
          bloqueado_hasta?: string | null
          identificador?: string
          intentos?: number
        }
        Relationships: []
      }
      items_orden_produccion: {
        Row: {
          cantidad_planeada: number
          id: string
          lote_id: string
          modelo_id: string
          talla_id: string
        }
        Insert: {
          cantidad_planeada: number
          id?: string
          lote_id: string
          modelo_id: string
          talla_id: string
        }
        Update: {
          cantidad_planeada?: number
          id?: string
          lote_id?: string
          modelo_id?: string
          talla_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "items_orden_produccion_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "lotes_produccion"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_orden_produccion_modelo_id_fkey"
            columns: ["modelo_id"]
            isOneToOne: false
            referencedRelation: "modelos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_orden_produccion_talla_id_fkey"
            columns: ["talla_id"]
            isOneToOne: false
            referencedRelation: "tallas"
            referencedColumns: ["id"]
          },
        ]
      }
      items_pedido: {
        Row: {
          cantidad: number
          id: string
          modelo_id: string
          notas: string | null
          pedido_id: string
          precio_unitario: number | null
          talla_id: string
        }
        Insert: {
          cantidad: number
          id?: string
          modelo_id: string
          notas?: string | null
          pedido_id: string
          precio_unitario?: number | null
          talla_id: string
        }
        Update: {
          cantidad?: number
          id?: string
          modelo_id?: string
          notas?: string | null
          pedido_id?: string
          precio_unitario?: number | null
          talla_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "items_pedido_modelo_id_fkey"
            columns: ["modelo_id"]
            isOneToOne: false
            referencedRelation: "modelos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_pedido_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_pedido_talla_id_fkey"
            columns: ["talla_id"]
            isOneToOne: false
            referencedRelation: "tallas"
            referencedColumns: ["id"]
          },
        ]
      }
      lote_etapas: {
        Row: {
          cantidad_completada: number
          estatus: string
          etapa_id: string | null
          id: string
          item_orden_id: string
          lote_id: string
          nombre_subproceso: string | null
          orden_secuencia: number | null
          parent_lote_etapa_id: string | null
        }
        Insert: {
          cantidad_completada?: number
          estatus?: string
          etapa_id?: string | null
          id?: string
          item_orden_id: string
          lote_id: string
          nombre_subproceso?: string | null
          orden_secuencia?: number | null
          parent_lote_etapa_id?: string | null
        }
        Update: {
          cantidad_completada?: number
          estatus?: string
          etapa_id?: string | null
          id?: string
          item_orden_id?: string
          lote_id?: string
          nombre_subproceso?: string | null
          orden_secuencia?: number | null
          parent_lote_etapa_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lote_etapas_etapa_id_fkey"
            columns: ["etapa_id"]
            isOneToOne: false
            referencedRelation: "etapas_proceso"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lote_etapas_item_orden_id_fkey"
            columns: ["item_orden_id"]
            isOneToOne: false
            referencedRelation: "items_orden_produccion"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lote_etapas_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "lotes_produccion"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lote_etapas_parent_lote_etapa_id_fkey"
            columns: ["parent_lote_etapa_id"]
            isOneToOne: false
            referencedRelation: "lote_etapas"
            referencedColumns: ["id"]
          },
        ]
      }
      lotes_produccion: {
        Row: {
          creado_por: string | null
          created_at: string
          estatus: Database["public"]["Enums"]["estatus_orden"]
          fecha_fin_estimada: string | null
          fecha_fin_real: string | null
          fecha_inicio: string | null
          folio: string
          id: string
          notas: string | null
          pedido_id: string | null
          ubicacion_destino_id: string | null
        }
        Insert: {
          creado_por?: string | null
          created_at?: string
          estatus?: Database["public"]["Enums"]["estatus_orden"]
          fecha_fin_estimada?: string | null
          fecha_fin_real?: string | null
          fecha_inicio?: string | null
          folio: string
          id?: string
          notas?: string | null
          pedido_id?: string | null
          ubicacion_destino_id?: string | null
        }
        Update: {
          creado_por?: string | null
          created_at?: string
          estatus?: Database["public"]["Enums"]["estatus_orden"]
          fecha_fin_estimada?: string | null
          fecha_fin_real?: string | null
          fecha_inicio?: string | null
          folio?: string
          id?: string
          notas?: string | null
          pedido_id?: string | null
          ubicacion_destino_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lotes_produccion_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lotes_produccion_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lotes_produccion_ubicacion_destino_id_fkey"
            columns: ["ubicacion_destino_id"]
            isOneToOne: false
            referencedRelation: "ubicaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      materiales: {
        Row: {
          categoria: string | null
          costo_unitario: number | null
          created_at: string
          id: string
          mide_cantidad_por_unidad: boolean
          nombre: string
          seguimiento_por_unidad: boolean
          stock_actual: number
          stock_minimo: number
          unidad_medida: string
        }
        Insert: {
          categoria?: string | null
          costo_unitario?: number | null
          created_at?: string
          id?: string
          mide_cantidad_por_unidad?: boolean
          nombre: string
          seguimiento_por_unidad?: boolean
          stock_actual?: number
          stock_minimo?: number
          unidad_medida: string
        }
        Update: {
          categoria?: string | null
          costo_unitario?: number | null
          created_at?: string
          id?: string
          mide_cantidad_por_unidad?: boolean
          nombre?: string
          seguimiento_por_unidad?: boolean
          stock_actual?: number
          stock_minimo?: number
          unidad_medida?: string
        }
        Relationships: []
      }
      modelo_tallas: {
        Row: {
          codigo_barras: string | null
          id: string
          modelo_id: string
          precio_venta: number | null
          sku: string | null
          talla_id: string
        }
        Insert: {
          codigo_barras?: string | null
          id?: string
          modelo_id: string
          precio_venta?: number | null
          sku?: string | null
          talla_id: string
        }
        Update: {
          codigo_barras?: string | null
          id?: string
          modelo_id?: string
          precio_venta?: number | null
          sku?: string | null
          talla_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "modelo_tallas_modelo_id_fkey"
            columns: ["modelo_id"]
            isOneToOne: false
            referencedRelation: "modelos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "modelo_tallas_talla_id_fkey"
            columns: ["talla_id"]
            isOneToOne: false
            referencedRelation: "tallas"
            referencedColumns: ["id"]
          },
        ]
      }
      modelos: {
        Row: {
          activo: boolean
          categoria: string | null
          costo_unitario: number | null
          created_at: string
          descripcion: string | null
          id: string
          imagen_url: string | null
          nombre: string
          precio_venta: number | null
        }
        Insert: {
          activo?: boolean
          categoria?: string | null
          costo_unitario?: number | null
          created_at?: string
          descripcion?: string | null
          id?: string
          imagen_url?: string | null
          nombre: string
          precio_venta?: number | null
        }
        Update: {
          activo?: boolean
          categoria?: string | null
          costo_unitario?: number | null
          created_at?: string
          descripcion?: string | null
          id?: string
          imagen_url?: string | null
          nombre?: string
          precio_venta?: number | null
        }
        Relationships: []
      }
      movimientos_inventario: {
        Row: {
          cantidad: number
          compra_id: string | null
          created_at: string
          id: string
          lote_id: string | null
          material_id: string
          motivo: string | null
          registrado_por: string | null
          tipo: Database["public"]["Enums"]["tipo_movimiento"]
        }
        Insert: {
          cantidad: number
          compra_id?: string | null
          created_at?: string
          id?: string
          lote_id?: string | null
          material_id: string
          motivo?: string | null
          registrado_por?: string | null
          tipo: Database["public"]["Enums"]["tipo_movimiento"]
        }
        Update: {
          cantidad?: number
          compra_id?: string | null
          created_at?: string
          id?: string
          lote_id?: string | null
          material_id?: string
          motivo?: string | null
          registrado_por?: string | null
          tipo?: Database["public"]["Enums"]["tipo_movimiento"]
        }
        Relationships: [
          {
            foreignKeyName: "movimientos_inventario_compra_id_fkey"
            columns: ["compra_id"]
            isOneToOne: false
            referencedRelation: "compras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimientos_inventario_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "lotes_produccion"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimientos_inventario_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materiales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimientos_inventario_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      movimientos_stock_producto: {
        Row: {
          cantidad: number
          created_at: string
          id: string
          modelo_id: string
          motivo: string | null
          orden_produccion_id: string | null
          registrado_por: string | null
          talla_id: string
          tipo: Database["public"]["Enums"]["tipo_movimiento"]
          traspaso_id: string | null
          ubicacion_id: string
        }
        Insert: {
          cantidad: number
          created_at?: string
          id?: string
          modelo_id: string
          motivo?: string | null
          orden_produccion_id?: string | null
          registrado_por?: string | null
          talla_id: string
          tipo: Database["public"]["Enums"]["tipo_movimiento"]
          traspaso_id?: string | null
          ubicacion_id?: string
        }
        Update: {
          cantidad?: number
          created_at?: string
          id?: string
          modelo_id?: string
          motivo?: string | null
          orden_produccion_id?: string | null
          registrado_por?: string | null
          talla_id?: string
          tipo?: Database["public"]["Enums"]["tipo_movimiento"]
          traspaso_id?: string | null
          ubicacion_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "movimientos_stock_producto_modelo_id_fkey"
            columns: ["modelo_id"]
            isOneToOne: false
            referencedRelation: "modelos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimientos_stock_producto_orden_produccion_id_fkey"
            columns: ["orden_produccion_id"]
            isOneToOne: false
            referencedRelation: "lotes_produccion"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimientos_stock_producto_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimientos_stock_producto_talla_id_fkey"
            columns: ["talla_id"]
            isOneToOne: false
            referencedRelation: "tallas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimientos_stock_producto_ubicacion_id_fkey"
            columns: ["ubicacion_id"]
            isOneToOne: false
            referencedRelation: "ubicaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      pagos_pedido: {
        Row: {
          created_at: string
          fecha: string
          id: string
          monto: number
          notas: string | null
          pedido_id: string
          registrado_por: string | null
        }
        Insert: {
          created_at?: string
          fecha?: string
          id?: string
          monto: number
          notas?: string | null
          pedido_id: string
          registrado_por?: string | null
        }
        Update: {
          created_at?: string
          fecha?: string
          id?: string
          monto?: number
          notas?: string | null
          pedido_id?: string
          registrado_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pagos_pedido_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_pedido_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pedidos: {
        Row: {
          cliente_id: string
          creado_por: string | null
          created_at: string
          dias_credito: number
          estatus: Database["public"]["Enums"]["estatus_pedido"]
          fecha_compromiso: string | null
          fecha_pedido: string
          folio: string
          id: string
          notas: string | null
        }
        Insert: {
          cliente_id: string
          creado_por?: string | null
          created_at?: string
          dias_credito?: number
          estatus?: Database["public"]["Enums"]["estatus_pedido"]
          fecha_compromiso?: string | null
          fecha_pedido?: string
          folio: string
          id?: string
          notas?: string | null
        }
        Update: {
          cliente_id?: string
          creado_por?: string | null
          created_at?: string
          dias_credito?: number
          estatus?: Database["public"]["Enums"]["estatus_pedido"]
          fecha_compromiso?: string | null
          fecha_pedido?: string
          folio?: string
          id?: string
          notas?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      perfiles: {
        Row: {
          activo: boolean
          created_at: string
          id: string
          nombre_completo: string
          permisos: string[]
          rol: Database["public"]["Enums"]["rol_usuario"]
          telefono: string | null
          usuario_corto: string | null
        }
        Insert: {
          activo?: boolean
          created_at?: string
          id: string
          nombre_completo: string
          permisos?: string[]
          rol?: Database["public"]["Enums"]["rol_usuario"]
          telefono?: string | null
          usuario_corto?: string | null
        }
        Update: {
          activo?: boolean
          created_at?: string
          id?: string
          nombre_completo?: string
          permisos?: string[]
          rol?: Database["public"]["Enums"]["rol_usuario"]
          telefono?: string | null
          usuario_corto?: string | null
        }
        Relationships: []
      }
      plantilla_items: {
        Row: {
          cantidad_sugerida: number | null
          id: string
          modelo_id: string
          plantilla_id: string
          talla_id: string
        }
        Insert: {
          cantidad_sugerida?: number | null
          id?: string
          modelo_id: string
          plantilla_id: string
          talla_id: string
        }
        Update: {
          cantidad_sugerida?: number | null
          id?: string
          modelo_id?: string
          plantilla_id?: string
          talla_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plantilla_items_modelo_id_fkey"
            columns: ["modelo_id"]
            isOneToOne: false
            referencedRelation: "modelos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plantilla_items_plantilla_id_fkey"
            columns: ["plantilla_id"]
            isOneToOne: false
            referencedRelation: "plantillas_pedido"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plantilla_items_talla_id_fkey"
            columns: ["talla_id"]
            isOneToOne: false
            referencedRelation: "tallas"
            referencedColumns: ["id"]
          },
        ]
      }
      plantillas_pedido: {
        Row: {
          cliente_id: string | null
          created_at: string
          id: string
          nombre: string
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string
          id?: string
          nombre: string
        }
        Update: {
          cliente_id?: string | null
          created_at?: string
          id?: string
          nombre?: string
        }
        Relationships: [
          {
            foreignKeyName: "plantillas_pedido_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      prendas_bordado: {
        Row: {
          bordada_por: string | null
          cliente_nombre: string
          cliente_telefono: string | null
          created_at: string
          descripcion: string
          estatus: Database["public"]["Enums"]["estatus_prenda_bordado"]
          fecha_bordada: string | null
          fecha_entrega_compromiso: string
          fecha_recibida: string
          fecha_recogida: string | null
          fecha_regresada: string | null
          folio: string
          id: string
          recibida_por: string
          recogida_por: string | null
          regresada_por: string | null
          updated_at: string
        }
        Insert: {
          bordada_por?: string | null
          cliente_nombre: string
          cliente_telefono?: string | null
          created_at?: string
          descripcion: string
          estatus?: Database["public"]["Enums"]["estatus_prenda_bordado"]
          fecha_bordada?: string | null
          fecha_entrega_compromiso: string
          fecha_recibida?: string
          fecha_recogida?: string | null
          fecha_regresada?: string | null
          folio: string
          id?: string
          recibida_por: string
          recogida_por?: string | null
          regresada_por?: string | null
          updated_at?: string
        }
        Update: {
          bordada_por?: string | null
          cliente_nombre?: string
          cliente_telefono?: string | null
          created_at?: string
          descripcion?: string
          estatus?: Database["public"]["Enums"]["estatus_prenda_bordado"]
          fecha_bordada?: string | null
          fecha_entrega_compromiso?: string
          fecha_recibida?: string
          fecha_recogida?: string | null
          fecha_regresada?: string | null
          folio?: string
          id?: string
          recibida_por?: string
          recogida_por?: string | null
          regresada_por?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prendas_bordado_bordada_por_fkey"
            columns: ["bordada_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prendas_bordado_recibida_por_fkey"
            columns: ["recibida_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prendas_bordado_recogida_por_fkey"
            columns: ["recogida_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prendas_bordado_regresada_por_fkey"
            columns: ["regresada_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      registros_avance_colaborador: {
        Row: {
          cantidad: number
          colaborador_id: string
          created_at: string
          fecha: string
          foto_url: string | null
          id: string
          lote_etapa_id: string
          lote_id: string
          observaciones: string | null
          origen: Database["public"]["Enums"]["origen_avance"]
          registrado_por: string
        }
        Insert: {
          cantidad: number
          colaborador_id: string
          created_at?: string
          fecha?: string
          foto_url?: string | null
          id?: string
          lote_etapa_id: string
          lote_id: string
          observaciones?: string | null
          origen?: Database["public"]["Enums"]["origen_avance"]
          registrado_por: string
        }
        Update: {
          cantidad?: number
          colaborador_id?: string
          created_at?: string
          fecha?: string
          foto_url?: string | null
          id?: string
          lote_etapa_id?: string
          lote_id?: string
          observaciones?: string | null
          origen?: Database["public"]["Enums"]["origen_avance"]
          registrado_por?: string
        }
        Relationships: [
          {
            foreignKeyName: "registros_avance_colaborador_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registros_avance_colaborador_lote_etapa_id_fkey"
            columns: ["lote_etapa_id"]
            isOneToOne: false
            referencedRelation: "lote_etapas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registros_avance_colaborador_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "lotes_produccion"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registros_avance_colaborador_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_productos: {
        Row: {
          cantidad_actual: number
          id: string
          modelo_id: string
          talla_id: string
          ubicacion_id: string
        }
        Insert: {
          cantidad_actual?: number
          id?: string
          modelo_id: string
          talla_id: string
          ubicacion_id: string
        }
        Update: {
          cantidad_actual?: number
          id?: string
          modelo_id?: string
          talla_id?: string
          ubicacion_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_productos_modelo_id_fkey"
            columns: ["modelo_id"]
            isOneToOne: false
            referencedRelation: "modelos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_productos_talla_id_fkey"
            columns: ["talla_id"]
            isOneToOne: false
            referencedRelation: "tallas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_productos_ubicacion_id_fkey"
            columns: ["ubicacion_id"]
            isOneToOne: false
            referencedRelation: "ubicaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      tallas: {
        Row: {
          codigo: string
          id: string
          orden: number
        }
        Insert: {
          codigo: string
          id?: string
          orden: number
        }
        Update: {
          codigo?: string
          id?: string
          orden?: number
        }
        Relationships: []
      }
      ubicaciones: {
        Row: {
          activa: boolean
          created_at: string
          id: string
          nombre: string
          orden: number
        }
        Insert: {
          activa?: boolean
          created_at?: string
          id?: string
          nombre: string
          orden?: number
        }
        Update: {
          activa?: boolean
          created_at?: string
          id?: string
          nombre?: string
          orden?: number
        }
        Relationships: []
      }
      unidades_material: {
        Row: {
          cantidad_actual: number
          cantidad_inicial: number
          codigo: string
          compra_item_id: string | null
          costo_unitario: number | null
          created_at: string
          estatus: Database["public"]["Enums"]["estatus_unidad_material"]
          fecha_recepcion: string
          id: string
          material_id: string
          numero_unidad: number
          proveedor: string | null
          registrado_por: string | null
        }
        Insert: {
          cantidad_actual: number
          cantidad_inicial: number
          codigo: string
          compra_item_id?: string | null
          costo_unitario?: number | null
          created_at?: string
          estatus?: Database["public"]["Enums"]["estatus_unidad_material"]
          fecha_recepcion?: string
          id?: string
          material_id: string
          numero_unidad: number
          proveedor?: string | null
          registrado_por?: string | null
        }
        Update: {
          cantidad_actual?: number
          cantidad_inicial?: number
          codigo?: string
          compra_item_id?: string | null
          costo_unitario?: number | null
          created_at?: string
          estatus?: Database["public"]["Enums"]["estatus_unidad_material"]
          fecha_recepcion?: string
          id?: string
          material_id?: string
          numero_unidad?: number
          proveedor?: string | null
          registrado_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "unidades_material_compra_item_id_fkey"
            columns: ["compra_item_id"]
            isOneToOne: false
            referencedRelation: "compra_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unidades_material_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materiales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unidades_material_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      venta_items: {
        Row: {
          cantidad: number
          costo_unitario: number | null
          descripcion: string
          id: string
          ieps_tasa: number
          importe: number
          iva_tasa: number
          modelo_id: string | null
          precio_unitario: number
          talla_id: string | null
          unidad: string
          venta_id: string
        }
        Insert: {
          cantidad: number
          costo_unitario?: number | null
          descripcion: string
          id?: string
          ieps_tasa?: number
          importe: number
          iva_tasa?: number
          modelo_id?: string | null
          precio_unitario: number
          talla_id?: string | null
          unidad?: string
          venta_id: string
        }
        Update: {
          cantidad?: number
          costo_unitario?: number | null
          descripcion?: string
          id?: string
          ieps_tasa?: number
          importe?: number
          iva_tasa?: number
          modelo_id?: string | null
          precio_unitario?: number
          talla_id?: string | null
          unidad?: string
          venta_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venta_items_modelo_id_fkey"
            columns: ["modelo_id"]
            isOneToOne: false
            referencedRelation: "modelos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venta_items_talla_id_fkey"
            columns: ["talla_id"]
            isOneToOne: false
            referencedRelation: "tallas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venta_items_venta_id_fkey"
            columns: ["venta_id"]
            isOneToOne: false
            referencedRelation: "ventas"
            referencedColumns: ["id"]
          },
        ]
      }
      venta_pagos: {
        Row: {
          id: string
          metodo: Database["public"]["Enums"]["metodo_pago"]
          monto: number
          recibido: number | null
          referencia: string | null
          venta_id: string
        }
        Insert: {
          id?: string
          metodo: Database["public"]["Enums"]["metodo_pago"]
          monto: number
          recibido?: number | null
          referencia?: string | null
          venta_id: string
        }
        Update: {
          id?: string
          metodo?: Database["public"]["Enums"]["metodo_pago"]
          monto?: number
          recibido?: number | null
          referencia?: string | null
          venta_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venta_pagos_venta_id_fkey"
            columns: ["venta_id"]
            isOneToOne: false
            referencedRelation: "ventas"
            referencedColumns: ["id"]
          },
        ]
      }
      ventas: {
        Row: {
          cancelada_por: string | null
          cliente_id: string | null
          created_at: string
          descuento: number
          estatus: Database["public"]["Enums"]["estatus_venta"]
          fecha_cancelacion: string | null
          folio: string
          id: string
          motivo_cancelacion: string | null
          notas: string | null
          sesion_id: string
          subtotal: number
          total: number
          ubicacion_id: string
          vendedor_id: string
        }
        Insert: {
          cancelada_por?: string | null
          cliente_id?: string | null
          created_at?: string
          descuento?: number
          estatus?: Database["public"]["Enums"]["estatus_venta"]
          fecha_cancelacion?: string | null
          folio: string
          id?: string
          motivo_cancelacion?: string | null
          notas?: string | null
          sesion_id: string
          subtotal?: number
          total?: number
          ubicacion_id: string
          vendedor_id: string
        }
        Update: {
          cancelada_por?: string | null
          cliente_id?: string | null
          created_at?: string
          descuento?: number
          estatus?: Database["public"]["Enums"]["estatus_venta"]
          fecha_cancelacion?: string | null
          folio?: string
          id?: string
          motivo_cancelacion?: string | null
          notas?: string | null
          sesion_id?: string
          subtotal?: number
          total?: number
          ubicacion_id?: string
          vendedor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ventas_cancelada_por_fkey"
            columns: ["cancelada_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ventas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ventas_sesion_id_fkey"
            columns: ["sesion_id"]
            isOneToOne: false
            referencedRelation: "cajas_sesiones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ventas_ubicacion_id_fkey"
            columns: ["ubicacion_id"]
            isOneToOne: false
            referencedRelation: "ubicaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ventas_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ventas_historicas: {
        Row: {
          caja: string | null
          cajero: string | null
          cliente_id: string | null
          cliente_nombre: string | null
          created_at: string
          deuda_actual: number
          deuda_inicial: number
          descuento: number
          entrega: string | null
          estatus: Database["public"]["Enums"]["estatus_venta_historica"]
          facturada: boolean
          fecha: string
          id: string
          nota: string | null
          numero: number
          pago_efectivo: number
          pago_tarjeta: number
          pago_transferencia: number
          reembolsos: number
          saldo_pendiente: number
          subtotal: number
          total: number
          total_actualizado: number
          vencimiento_deuda: string | null
          vendedor: string | null
        }
        Insert: {
          caja?: string | null
          cajero?: string | null
          cliente_id?: string | null
          cliente_nombre?: string | null
          created_at?: string
          deuda_actual?: number
          deuda_inicial?: number
          descuento?: number
          entrega?: string | null
          estatus: Database["public"]["Enums"]["estatus_venta_historica"]
          facturada?: boolean
          fecha: string
          id?: string
          nota?: string | null
          numero: number
          pago_efectivo?: number
          pago_tarjeta?: number
          pago_transferencia?: number
          reembolsos?: number
          subtotal: number
          total: number
          total_actualizado: number
          vencimiento_deuda?: string | null
          vendedor?: string | null
        }
        Update: {
          caja?: string | null
          cajero?: string | null
          cliente_id?: string | null
          cliente_nombre?: string | null
          created_at?: string
          deuda_actual?: number
          deuda_inicial?: number
          descuento?: number
          entrega?: string | null
          estatus?: Database["public"]["Enums"]["estatus_venta_historica"]
          facturada?: boolean
          fecha?: string
          id?: string
          nota?: string | null
          numero?: number
          pago_efectivo?: number
          pago_tarjeta?: number
          pago_transferencia?: number
          reembolsos?: number
          subtotal?: number
          total?: number
          total_actualizado?: number
          vencimiento_deuda?: string | null
          vendedor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ventas_historicas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      fn_abrir_caja: {
        Args: { p_fondo_inicial?: number; p_ubicacion_id: string }
        Returns: string
      }
      fn_cancelar_venta: {
        Args: { p_motivo: string; p_venta_id: string }
        Returns: undefined
      }
      fn_cerrar_caja: {
        Args: {
          p_efectivo_contado: number
          p_notas?: string
          p_sesion_id: string
          p_tarjeta_contado?: number
          p_transferencia_contado?: number
        }
        Returns: number
      }
      fn_efectivo_esperado: {
        Args: { p_sesion_id: string }
        Returns: number
      }
      fn_totales_esperados: {
        Args: { p_sesion_id: string }
        Returns: { efectivo: number; tarjeta: number; transferencia: number }[]
      }
      fn_permisos_por_rol: {
        Args: { p_rol: Database["public"]["Enums"]["rol_usuario"] }
        Returns: string[]
      }
      fn_rango_ventas: {
        Args: never
        Returns: { primera: string; ultima: string }[]
      }
      fn_reporte_ventas: {
        Args: { p_agrupar?: string; p_desde: string; p_hasta: string }
        Returns: {
          bruto: number
          descuentos: number
          efectivo: number
          neto: number
          periodo: string
          por_cobrar: number
          reembolsos: number
          tarjeta: number
          transferencia: number
          ventas: number
        }[]
      }
      fn_reporte_ventas_por: {
        Args: { p_desde: string; p_dimension: string; p_hasta: string; p_limite?: number }
        Returns: { clave: string; neto: number; ventas: number }[]
      }
      fn_resumen_clientes: {
        Args: never
        Returns: { cliente_id: string; saldo: number; total: number; ultima_compra: string; ventas: number }[]
      }
      fn_ventas_cliente: {
        Args: { p_cliente_id: string }
        Returns: {
          estatus: string
          fecha: string
          nota: string
          origen: string
          pagado: number
          referencia: string
          saldo: number
          total: number
          venta_id: string
        }[]
      }
      fn_registrar_movimiento_caja: {
        Args: {
          p_concepto: string
          p_monto: number
          p_sesion_id: string
          p_tipo: Database["public"]["Enums"]["tipo_movimiento_caja"]
        }
        Returns: string
      }
      fn_registrar_venta: {
        Args: {
          p_cliente_id: string | null
          p_descuento?: number
          p_items: Json
          p_notas?: string
          p_pagos: Json
          p_ubicacion_id: string
        }
        Returns: string
      }
      fn_rol_actual: {
        Args: never
        Returns: Database["public"]["Enums"]["rol_usuario"]
      }
      fn_tiene_permiso: {
        Args: { p_permiso: string }
        Returns: boolean
      }
      fn_traspasar_stock_producto: {
        Args: {
          p_cantidad: number
          p_destino_id: string
          p_modelo_id: string
          p_motivo?: string
          p_origen_id: string
          p_talla_id: string
        }
        Returns: string
      }
      fn_ubicacion_predeterminada: {
        Args: never
        Returns: string
      }
    }
    Enums: {
      estatus_entrega: "programada" | "en_ruta" | "entregada" | "cancelada"
      estatus_orden: "planeada" | "en_proceso" | "terminada" | "cancelada"
      estatus_pedido:
        | "cotizacion"
        | "confirmado"
        | "en_produccion"
        | "listo"
        | "entregado"
        | "cancelado"
      estatus_prenda_bordado:
        | "recibida_en_tienda"
        | "recogida_para_bordar"
        | "bordada"
        | "regresada_a_tienda"
      estatus_unidad_material: "disponible" | "agotado" | "de_baja"
      estatus_venta: "completada" | "cancelada"
      estatus_venta_historica: "pagada" | "deuda_pendiente" | "impaga" | "reembolsada" | "cancelada"
      metodo_pago: "efectivo" | "transferencia" | "tarjeta"
      origen_avance: "colaborador" | "ajuste_supervisor"
      rol_usuario: "admin" | "ventas" | "supervisor" | "colaborador"
      tipo_movimiento: "entrada" | "salida" | "ajuste"
      tipo_movimiento_caja: "ingreso" | "retiro"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      estatus_entrega: ["programada", "en_ruta", "entregada", "cancelada"],
      estatus_orden: ["planeada", "en_proceso", "terminada", "cancelada"],
      estatus_pedido: [
        "cotizacion",
        "confirmado",
        "en_produccion",
        "listo",
        "entregado",
        "cancelado",
      ],
      estatus_prenda_bordado: [
        "recibida_en_tienda",
        "recogida_para_bordar",
        "bordada",
        "regresada_a_tienda",
      ],
      estatus_unidad_material: ["disponible", "agotado", "de_baja"],
      estatus_venta: ["completada", "cancelada"],
      estatus_venta_historica: ["pagada", "deuda_pendiente", "impaga", "reembolsada", "cancelada"],
      metodo_pago: ["efectivo", "transferencia", "tarjeta"],
      origen_avance: ["colaborador", "ajuste_supervisor"],
      rol_usuario: ["admin", "ventas", "supervisor", "colaborador"],
      tipo_movimiento: ["entrada", "salida", "ajuste"],
      tipo_movimiento_caja: ["ingreso", "retiro"],
    },
  },
} as const

// Alias de conveniencia usados en el resto de la app.
export type RolUsuario = Database["public"]["Enums"]["rol_usuario"]
export type EstatusPedido = Database["public"]["Enums"]["estatus_pedido"]
export type EstatusOrden = Database["public"]["Enums"]["estatus_orden"]
export type OrigenAvance = Database["public"]["Enums"]["origen_avance"]
export type TipoMovimiento = Database["public"]["Enums"]["tipo_movimiento"]
export type EstatusEntrega = Database["public"]["Enums"]["estatus_entrega"]
export type EstatusUnidadMaterial = Database["public"]["Enums"]["estatus_unidad_material"]
export type EstatusPrendaBordado = Database["public"]["Enums"]["estatus_prenda_bordado"]
export type Ubicacion = Database["public"]["Tables"]["ubicaciones"]["Row"]
export type MetodoPago = Database["public"]["Enums"]["metodo_pago"]
export type EstatusVenta = Database["public"]["Enums"]["estatus_venta"]
export type EstatusVentaHistorica = Database["public"]["Enums"]["estatus_venta_historica"]
export type TipoMovimientoCaja = Database["public"]["Enums"]["tipo_movimiento_caja"]
