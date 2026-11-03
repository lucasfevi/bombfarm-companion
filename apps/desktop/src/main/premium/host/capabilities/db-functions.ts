/**
 * What a tracking query may call. The scalar, aggregate, window and macro functions DuckDB 1.5.5
 * ships (core, json and icu families), minus everything that reads or changes settings, files,
 * sequences, the catalog or the logger, or that runs a string as SQL. A query naming anything else
 * is refused; a table function is allowed only from `ALLOWED_TABLE_FUNCTIONS`. The list is pinned
 * against the live engine by a test, so a DuckDB bump that adds a function fails it until reviewed.
 */

/** Refused by name, though the engine ships them. */
export const EXCLUDED_FUNCTION_NAMES: readonly string[] = [
  'nextval',
  'currval',
  'current_setting',
  'current_query',
  'current_query_id',
  'current_connection_id',
  'current_transaction_id',
  'current_catalog',
  'current_database',
  'current_schema',
  'current_schemas',
  'getvariable',
  'sleep_ms',
  'write_log',
  'setseed',
  'json_serialize_sql',
  'json_deserialize_sql',
  'json_serialize_plan',
  'parse_duckdb_log_message',
  'get_block_size',
  'format_pg_type',
  'format_type',
  'map_to_pg_oid',
  'col_description',
  'obj_description',
  'shobj_description',
];

/** Refused by prefix: catalog helpers, privilege checks, transaction ids, collation names, network. */
export const EXCLUDED_FUNCTION_PREFIXES: readonly string[] = ['pg_', 'has_', 'txid_', 'icu_collate_', 'inet_'];

/** Table functions that read nothing outside the query. */
export const ALLOWED_TABLE_FUNCTIONS: ReadonlySet<string> = new Set(['range', 'generate_series', 'unnest', 'json_each', 'json_tree']);

/** Allowed in a select list too, though DuckDB lists it as a table function. */
export const EXTRA_ALLOWED_FUNCTIONS: readonly string[] = ['unnest'];

const NAMES = `
!__postfix,!~~,!~~*,%,&,&&,*,**,+,-,->>,/,//,<->,<<,<=>,<@,>>,@,@>,^,^@
__internal_compress_integral_ubigint,__internal_compress_integral_uinteger
__internal_compress_integral_usmallint,__internal_compress_integral_utinyint
__internal_compress_string_hugeint,__internal_compress_string_ubigint
__internal_compress_string_uhugeint,__internal_compress_string_uinteger
__internal_compress_string_usmallint,__internal_compress_string_utinyint
__internal_decompress_integral_bigint,__internal_decompress_integral_hugeint
__internal_decompress_integral_integer,__internal_decompress_integral_smallint
__internal_decompress_integral_ubigint,__internal_decompress_integral_uhugeint
__internal_decompress_integral_uinteger,__internal_decompress_integral_usmallint
__internal_decompress_string,abs,acos,acosh,add,age,aggregate,ago,alias,any_value,apply
approx_count_distinct,approx_quantile,approx_top_k,arbitrary,arg_max,arg_max_null,arg_max_nulls_last
arg_min,arg_min_null,arg_min_nulls_last,argmax,argmin,array_agg,array_aggr,array_aggregate
array_append,array_apply,array_cat,array_concat,array_contains,array_cosine_distance
array_cosine_similarity,array_cross_product,array_distance,array_distinct,array_dot_product
array_extract,array_filter,array_grade_up,array_has,array_has_all,array_has_any,array_indexof
array_inner_product,array_intersect,array_length,array_negative_dot_product
array_negative_inner_product,array_pop_back,array_pop_front,array_position,array_prepend
array_push_back,array_push_front,array_reduce,array_resize,array_reverse,array_reverse_sort
array_select,array_slice,array_sort,array_to_json,array_to_string,array_to_string_comma_default
array_transform,array_unique,array_value,array_where,array_zip,ascii,asin,asinh,atan,atan2,atanh,avg
bar,base64,bin,bit_and,bit_count,bit_length,bit_or,bit_position,bit_xor,bitstring,bitstring_agg
bool_and,bool_or,can_cast_implicitly,cardinality,cast_to_type,cbrt,ceil,ceiling,century,char_length
character_length,chr,combine,concat,concat_ws,constant_or_null,contains,corr,cos,cosh,cot,count
count_if,count_star,countif,covar_pop,covar_samp,create_sort_key,cume_dist,current_date
current_localtime,current_localtimestamp,current_role,current_user,damerau_levenshtein,date_add
date_diff,date_part,date_sub,date_trunc,datediff,datepart,datesub,datetrunc,day,dayname,dayofmonth
dayofweek,dayofyear,days_in_month,decade,decode,degrees,dense_rank,divide,editdist3,element_at
encode,ends_with,entropy,enum_code,enum_first,enum_last,enum_range,enum_range_boundary,epoch
epoch_ms,epoch_ns,epoch_us,equi_width_bins,era,error,even,exp,factorial,favg,fdiv,fill,filter
finalize,first,first_value,flatten,floor,fmod,format,format_bytes,formatreadabledecimalsize
formatreadablesize,from_base64,from_binary,from_hex,from_json,from_json_strict,fsum,gamma,gcd
gen_random_uuid,generate_series,generate_subscripts,geomean,geometric_mean,get_bit,get_current_time
get_current_timestamp,get_type,grade_up,greatest,greatest_common_divisor,group_concat,hamming,hash
hex,histogram,histogram_exact,hour,icu_sort_key,ilike_escape,in_search_path,instr
is_histogram_other_bin,isfinite,isinf,isnan,isodow,isoyear,jaccard,jaro_similarity
jaro_winkler_similarity,json,json_array,json_array_length,json_contains,json_exists,json_extract
json_extract_path,json_extract_path_text,json_extract_string,json_group_array,json_group_object
json_group_structure,json_keys,json_merge_patch,json_object,json_pretty,json_quote,json_structure
json_transform,json_transform_strict,json_type,json_valid,json_value,julian,kahan_sum,kurtosis
kurtosis_pop,lag,last,last_day,last_value,lcase,lcm,lead,least,least_common_multiple,left
left_grapheme,len,length,length_grapheme,levenshtein,lgamma,like_escape,list,list_aggr
list_aggregate,list_any_value,list_append,list_apply,list_approx_count_distinct,list_avg
list_bit_and,list_bit_or,list_bit_xor,list_bool_and,list_bool_or,list_cat,list_concat,list_contains
list_cosine_distance,list_cosine_similarity,list_count,list_distance,list_distinct,list_dot_product
list_element,list_entropy,list_extract,list_filter,list_first,list_grade_up,list_has,list_has_all
list_has_any,list_histogram,list_indexof,list_inner_product,list_intersect,list_kurtosis
list_kurtosis_pop,list_last,list_mad,list_max,list_median,list_min,list_mode
list_negative_dot_product,list_negative_inner_product,list_pack,list_position,list_prepend
list_product,list_reduce,list_resize,list_reverse,list_reverse_sort,list_select,list_sem
list_skewness,list_slice,list_sort,list_stddev_pop,list_stddev_samp,list_string_agg,list_sum
list_transform,list_unique,list_value,list_var_pop,list_var_samp,list_where,list_zip,listagg,ln,log
log10,log2,lower,lpad,ltrim,mad,make_date,make_time,make_timestamp,make_timestamp_ms
make_timestamp_ns,make_timestamptz,make_type,map,map_concat,map_contains,map_contains_entry
map_contains_value,map_entries,map_extract,map_extract_value,map_from_entries,map_keys,map_values
max,max_by,md5,md5_number,md5_number_lower,md5_number_upper,mean,median,microsecond,millennium
millisecond,min,min_by,minute,mismatches,mod,mode,month,monthname,multiply,nanosecond,nextafter
nfc_normalize,normalized_interval,not_ilike_escape,not_like_escape,now,nth_value,ntile,nullif
octet_length,ord,parse_dirname,parse_dirpath,parse_filename,parse_formatted_bytes,parse_path
percent_rank,pi,position,pow,power,prefix,printf,product,quantile,quantile_cont,quantile_disc
quarter,radians,random,range,rank,rank_dense,reduce,regexp_escape,regexp_extract,regexp_extract_all
regexp_full_match,regexp_matches,regexp_replace,regexp_split_to_array,regexp_split_to_table
regr_avgx,regr_avgy,regr_count,regr_intercept,regr_r2,regr_slope,regr_sxx,regr_sxy,regr_syy
remap_struct,repeat,replace,replace_type,reservoir_quantile,reverse,right,right_grapheme,round
round_even,roundbankers,row,row_number,row_to_json,rpad,rtrim,second,sem,session_user,set_bit,sha1
sha256,sign,signbit,sin,sinh,skewness,split,split_part,sqrt,st_asbinary,st_astext,st_aswkb,st_aswkt
st_crs,st_geomfromwkb,st_intersects_extent,st_setcrs,starts_with,stats,stddev,stddev_pop,stddev_samp
str_split,str_split_regex,strftime,string_agg,string_split,string_split_regex,string_to_array
strip_accents,strlen,strpos,strptime,struct_concat,struct_contains,struct_extract,struct_extract_at
struct_has,struct_indexof,struct_insert,struct_keys,struct_pack,struct_position,struct_update
struct_values,substr,substring,substring_grapheme,subtract,suffix,sum,sum_no_overflow,sumkahan
switch,tan,tanh,time_bucket,timetz_byte_comparable,timezone,timezone_hour,timezone_minute,to_base
to_base64,to_binary,to_centuries,to_days,to_decades,to_hex,to_hours,to_json,to_microseconds
to_millennia,to_milliseconds,to_minutes,to_months,to_quarters,to_seconds,to_timestamp,to_weeks
to_years,today,transaction_timestamp,translate,trim,trunc,try_strptime,typeof,ucase,unbin,unhex
unicode,union_extract,union_tag,union_value,unpivot_list,upper,url_decode,url_encode,user,uuid
uuid_extract_timestamp,uuid_extract_version,uuidv4,uuidv7,var_pop,var_samp,variance
variant_bytes_to_variant,variant_extract,variant_normalize,variant_to_parquet_variant,variant_typeof
vector_type,version,wavg,week,weekday,weekofyear,weighted_avg,xor,year,yearweek,|,||,~,~~,~~*,~~~
`;

export const ALLOWED_FUNCTIONS: ReadonlySet<string> = new Set([
  ...NAMES.split(/[\s,]+/).filter((name) => name !== ''),
  ...EXTRA_ALLOWED_FUNCTIONS,
]);
