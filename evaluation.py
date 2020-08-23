#!/usr/bin/python3

import json

from typing import Dict, List

from dataclasses import dataclass, field
from enum import Enum
from dataclasses_json import dataclass_json

from subprocess import run, TimeoutExpired


from jinja2 import FileSystemLoader, Environment
from os.path import join, exists, getmtime

from alive_progress import alive_bar


config_path = 'benches.json'
evaluation_benchmarks = 'evaluation-current.json'
output_dir = 'eval/tmp/'
timeout_length = 60 * 2 # 30 mins; not currently used, set in Benchmarking.ts


@dataclass_json
@dataclass
class FocusSchema:
  # height: List[int] = field(default_factory=lambda: [0, 0])# always just 2 
  # width: List[int] = field(default_factory=lambda: [0, 0]) # always just 2
  root: str = 'TODO'
  script_key: str = 'TODO'

@dataclass_json
@dataclass
class BenchSchema:
  description: str = 'TODO'
  src: str = 'TODO'
  url: str = 'TODO'
  script_key: str = 'TODO'
  benches: Dict[str, FocusSchema] = field(default_factory=lambda: {})

@dataclass_json
@dataclass
class EvalSchema:
  eval: Dict[str, BenchSchema]

@dataclass_json
@dataclass
class OutputSchema:
  constraints: List[List[str]]


def all_items(tree): 
  yield tree
  for child in tree['children']:
    for item in all_items(child):
      yield item

def find(name: str, tree):
  for value in all_items(tree):
    if name == value['name']:
      return value
  raise Exception('missing element %s' % name)


def run_bench(parent: BenchSchema, local: FocusSchema, timeout: int = timeout_length):
  with open('benches.json') as script_file:
    script_config = json.load(script_file)
  p_key, local_key = parent.script_key, local.script_key

  print(f"Running bench {p_key}, {local_key}")

  script_data = script_config[p_key][local_key]
  if 'width' in script_data and 'height' in script_data:
    with open(output_dir + 'bench-%s.log' % local.script_key, 'w') as bench_out:
      run(['./bench.sh', p_key, local_key, 'hier', '--timeout', str(timeout), '--loclearn', 'bayesian'], stdout=bench_out, stderr=bench_out)
    print(f"Finished.")
    return parse_result_from_file(output_dir + 'bench-%s.log' % local.script_key, local.script_key)
  else:
    print('error: bad auto-mock script entry')
    print(parent)
    print(local)
    raise Exception()

# for each benchmark:

@dataclass_json
@dataclass
class BenchmarkSchema:
  accuracy: float
  error: float
  elems: int
  constraints: int
  prep: float
  resize: float
  synth: float
  name: str = 'empty'

  finished: bool = True

  def csv_row(self):
    return '%s,%.3f,%d,%.3f,%d,%.3f,%.3f,%.3f' % (self.name, self.error, self.elems, self.accuracy, self.constraints, self.prep, self.resize, self.synth) if self.finished else '%s,-,-,-,-,-,-,-,-' % self.name

def aggregate_avg(xs: List[BenchmarkSchema], name: str):

  assert len(xs) > 0

  xs_valid = [x for x in xs if x.finished]

  fields = ['accuracy', 'error', 'elems', 'constraints', 'prep', 'resize', 'synth']

  kwargs = {}

  for fld in fields:
    view = [getattr(x, fld) for x in xs_valid]
    if len(view) > 0:
      avg_val = sum(view)/len(view)
      kwargs[fld] = avg_val
    else:
      return benchmark_error_value(name)
  kwargs['name'] = name

  return BenchmarkSchema(**kwargs)

def aggregate_sum(xs: List[BenchmarkSchema], name: str):

  assert len(xs) > 0

  xs_valid = [x for x in xs if x.finished]

  fields = ['accuracy', 'error', 'elems', 'constraints', 'prep', 'resize', 'synth']

  kwargs = {}

  for fld in fields:
    view = [getattr(x, fld) for x in xs_valid]
    if len(view) > 0:
      kwargs[fld] = sum(view)
    else:
      return benchmark_error_value(name)
  kwargs['name'] = name

  return BenchmarkSchema(**kwargs)

def benchmark_error_value(name: str):
  return BenchmarkSchema(0.0, 0.0, 0, 0, 0.0, 0.0, 0.0, name, False)
def make_table_header():
  return 'Name, Avg RMS, Number of elements, Accuracy, Number of constraints, Prep time, Resize time, Synth time'

def parse_result_from_file(log_output_fname: str, name) -> BenchmarkSchema:
  with open(log_output_fname, 'r') as log_output:
    kwargs: Dict[str, object] = {}
    parsing = False
    keys = ['accuracy', 'error', 'elems', 'constraints', 'prep', 'resize', 'synth']
    for f_line in log_output:
      lines = f_line.split(' ')

      if len(lines) < 1: continue
      if lines[0][0:-1] == '{': 
        parsing = True
        continue
      if lines[0][0:-1] == '}': 
        parsing = False
        continue
      if parsing and lines[2][0:-1] in keys:
        val_str = lines[3][0:-1]
        if val_str[-1] == ',': val_str = val_str[0:-1]

        kwargs[lines[2][0:-1]] = eval(val_str)
    
    if len(kwargs) == 7:
      kwargs['name'] = name
      kwargs['finished'] = True
      return BenchmarkSchema(**kwargs)
    else:
      # print('')
      print('invalid parse of result in ' + log_output_fname)
      return benchmark_error_value(name)

      

def run_all_macro():
  results: List[BenchmarkSchema] = []
  results_fname = output_dir + 'macro_results.csv'
  with open('evaluation-current.json') as eval_file:
    benches: EvalSchema = EvalSchema.schema().loads(eval_file.read())
  open(results_fname, 'w').close()
  with open(results_fname, 'a') as results_file:
    print(make_table_header(), file=results_file)
    print('starting macrobenchmarks')
    results = []
    for root_name, bench in benches.eval.items():
      # if root_name != 'duckduckgo': continue
      if root_name == 'synthetic': continue # synthetic benchmarks are not part of macro because of reasons...TODO
      print('running macro %s' % root_name)

      try:
        # result = run_bench(bench, bench.benches['main'])
        result = parse_result_from_file(output_dir + 'bench-%s.log' % bench.benches['main'].script_key, bench.benches['main'].script_key)
      except Exception as e:
        print('exception: ')
        print(e)
        result = benchmark_error_value(root_name)
      
      results.append(result)

      print(result.csv_row(), file=results_file)

    if len(results) > 0:
      res_avg = aggregate_avg(results, 'avg')
      print(res_avg.csv_row(), file=results_file)
      res_sum = aggregate_sum(results,'sum')
      print(res_sum.csv_row(), file=results_file)
  print('done! results printed to %s' % results_fname)

def run_all_micro(*args: str):
  results: List[BenchmarkSchema] = []
  timeout = 120 # 2 minutes
  results_fname = output_dir + 'micro_results.csv'
  with open('evaluation-current.json') as eval_file:
    benches: EvalSchema = EvalSchema.schema().loads(eval_file.read())
  open(results_fname, 'w').close()
  with open(results_fname, 'a') as results_file:
    print('Group, ' + make_table_header(), file=results_file)
    print('starting all microbenchmarks')
    for root_name, bench in benches.eval.items():

      if len(args) > 0:
        if not root_name in args: continue
      
      print('running group %s' % root_name)
      # current = ['duckduckgo', 'fwt-running']
      # if not root_name in current: continue

      results = []

      for micro_name, micro in bench.benches.items():
        if micro_name == "main": continue

        try:
          result = run_bench(bench, micro, timeout=timeout)
          # result = parse_result_from_file(output_dir + 'bench-%s.log' % micro.script_key, micro.script_key)
        except Exception as e:
          print('exception: ')
          print(e)
          result = benchmark_error_value(micro_name)

        results.append(result)
      
        print(root_name + ', ' + result.csv_row(), file=results_file)
      
      # if len(results) > 0:
      #   res_avg = aggregate_avg(results, root_name + '-avg')
      #   print(root_name + ', ' + res_avg.csv_row(), file=results_file)
      #   res_sum = aggregate_sum(results, root_name + '-sum')
      #   print(root_name + ', ' + res_sum.csv_row(), file=results_file)

  print('done! results printed to %s' % results_fname)

def generate_micros(*args: str):
  with open('evaluation-current.json') as eval_file:
    benches: EvalSchema = EvalSchema.schema().loads(eval_file.read())
    # print(benches)

  for root_name, bench in benches.eval.items():
    if root_name == 'synthetic': continue # synthetic benchmarks are not grouped like other micros
    if len(args) > 0:
      if not root_name in args: continue
    print('loading root %s' % bench.benches['main'].script_key)
    with open('bench_cache/%s.json' % bench.benches['main'].script_key) as bench_file:
      root_experiment = json.load(bench_file)

    new_root_config = {bench.script_key : {}}

    for bench_name, details in bench.benches.items():
      if bench_name == 'main': continue

      search_name = details.root
      outbench = {'name': root_name + '-' + bench_name}
      train, test = [find(search_name, tree) for tree in root_experiment['train']], [find(search_name, tree) for tree in root_experiment['test']]

      all_values = train + test

      hs, ws = [v['height'] for v in all_values], [v['width'] for v in all_values]

      benchopts = {}

      benchopts['height'] = {'low': min(hs), 'high': max(hs)}
      benchopts['width'] = {'low': min(ws), 'high': max(ws)}

      for prop in ['trainSeed', 'testSeed']:
        benchopts[prop] = root_experiment['bench'][prop]
      
      benchopts['testSize'] = len(test)
      benchopts['trainSize'] = len(train)

      outbench['bench'] = benchopts
      outbench['train'] = train
      outbench['test'] = test

      with open('bench_cache/%s.json' % details.script_key, 'w') as outbfile:
        json.dump(outbench, outbfile)

    for bench_name, details in bench.benches.items():
      print('loading %s' % details.script_key)
      with open('bench_cache/%s.json' % details.script_key) as outbfile:
        experiment = json.load(outbfile)
      
      new_config = {
        # 'description': 
        'height' : experiment['bench']['height'],
        'width' : experiment['bench']['width']  
      }

      new_root_config[bench.script_key][details.script_key] = new_config 


    with open('new-config-%s.json' % bench.script_key, 'w') as outfile:
      json.dump(new_root_config, outfile)

def run_hier_eval():
  # index corresponds to number of rows i.e. benches[i] === benchmark name for i+1 rows
  benches = ['fwt-posts-3', 'fwt-posts-6', 'fwt-posts-9', 'fwt-posts-12']
  group = 'fwt'
  timeout = 240

  hier_times : List[float] = []
  flat_times : List[float] = []



  for rows in range(len(benches)):
    times : List[float] = []
    iters = 3
    with alive_bar(iters) as bar:
      print('starting hier benches')
      for i in range(iters):
        print('starting iter %d' % i)
        fname = output_dir + 'hier-bench-%d.log' % rows
        with open(fname, 'w') as bench_out:
          run(['./bench.sh', group, benches[rows], 'hier', '--timeout', str(timeout)], stdout=bench_out, stderr=bench_out)
        result = parse_result_from_file(fname, 'hier-bench-%d' % rows)
        times.append(result.synth)
        bar()
    hier_times.append(sum(times)/(1.0*len(times)))

    times = []
    with alive_bar(iters) as bar:
      print('starting flat benches')
      for i in range(iters):
        print('starting iter %d' % i)
        fname = output_dir + 'flat-bench-%d.log' % rows
        with open(fname, 'w') as bench_out:
          run(['./bench.sh', group, benches[rows], 'base', '--timeout', str(timeout)], stdout=bench_out, stderr=bench_out)
        result = parse_result_from_file(fname, 'flat-bench-%d' % rows)
        times.append(result.synth)
        bar()
    flat_times.append(sum(times)/(1.0*len(times)))

  outstr = "Algorithm"
  for row in range(len(benches)):
    outstr += ", %d rows" % (row + 1)
  
  print(outstr)

  # for alg in ["Hier", "Flat"]:
  outstr = "Hier"
  for row in range(len(benches)):
    outstr += ", %.2f" % hier_times[row]
  outstr = "Flat"
  for row in range(len(benches)):
    outstr += ", %.2f" % flat_times[row]

  print(outstr)







loader = FileSystemLoader('./eval/templates/')
if __name__ == "__main__":

  run_all_micro()
  # run_all_macro()
  # generate_micros('ace')
  # run_hier_eval()
  
      